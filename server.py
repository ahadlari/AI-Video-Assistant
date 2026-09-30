"""
FastAPI AI Worker Service for AI Video Assistant.
This service is internal and should only be called by the Spring Boot backend.
It handles video downloading, transcription, summarization, and RAG search.
"""

import os
import uuid
import asyncio
import httpx
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header, UploadFile, File, Form, Depends

from dotenv import load_dotenv
load_dotenv()

from utils.audio_processor import process_input, cleanup_audio_files
from core.transcriber import transcribe_all
from core.summarizer import analyze_video
from core.video_info import get_video_metadata
from core.rag_engine import ask_question, get_embeddings

app = FastAPI(title="AI Worker Service", version="2.0.0")

INTERNAL_KEY = os.getenv("INTERNAL_API_KEY")
if not INTERNAL_KEY or INTERNAL_KEY == "dev_secret_key_123":
    raise RuntimeError("INTERNAL_API_KEY is not set securely! Generate one using 'openssl rand -base64 32'")

SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")

# ── Dependencies ─────────────────────────────────────────────────────────────

def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid Internal Key")
    return True

# ── Request Models ───────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    question: str
    language: str = "english"
    history: List[dict] = []

class ChatResponse(BaseModel):
    answer: str

# ── Background Task ──────────────────────────────────────────────────────────

async def send_callback(job_id: str, payload: dict):
    """Sends a callback to Spring Boot to update job status and data. Fails gracefully."""
    print(f"[JOB {job_id}] Sending callback: {payload.get('status')} - {payload.get('step', '')}")
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{SPRING_BOOT_URL}/internal/callback/{job_id}",
                json=payload,
                headers={"X-Internal-Key": INTERNAL_KEY},
                timeout=10.0
            )
        except Exception as e:
            print(f"[JOB {job_id}] WARNING: Callback to Spring Boot failed, but job will continue. Error: {e}")


async def process_video_background(
    job_id: str, 
    session_id: str, 
    source: str, 
    audio_language: str, 
    summary_language: str,
    file_path: Optional[str] = None
):
    try:
        print(f"\n[JOB {job_id}] --- STARTING PROCESS ---")
        print(f"[JOB {job_id}] Target source: {file_path if file_path else source}")
        
        metadata = {"title": "Uploaded File", "description": ""}
        if not file_path:
            print(f"[JOB {job_id}] Fetching YouTube metadata via OEmbed...")
            metadata = get_video_metadata(source)

        transcript = None
        
        # 1. Download and Process Audio
        await send_callback(job_id, {"status": "processing", "step": "downloading", "progress": 10})
        target_source = file_path if file_path else source
        chunks = process_input(target_source)
        
        # 2. Transcription
        print(f"[JOB {job_id}] Starting Transcription...")
        await send_callback(job_id, {"status": "processing", "step": "transcribing", "progress": 40})
        transcript = transcribe_all(chunks, audio_language, metadata)
        
        # 3. Summarization
        print(f"[JOB {job_id}] Starting LLM Summarization...")
        await send_callback(job_id, {"status": "processing", "step": "summarizing", "progress": 70})
        analysis_result = analyze_video(transcript, summary_language, metadata)
        
        # 4. Indexing (Generating Embeddings)
        print(f"[JOB {job_id}] Starting Vector Embedding generation...")
        await send_callback(job_id, {"status": "processing", "step": "indexing", "progress": 90})
        
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        text_chunks = splitter.split_text(transcript)
        
        embedder = get_embeddings()
        embeddings = embedder.embed_documents(text_chunks)
        
        vector_chunks = []
        for i, text in enumerate(text_chunks):
            vector_chunks.append({
                "chunk_index": i,
                "chunk_text": text,
                "embedding": embeddings[i]
            })
            
        if vector_chunks and len(vector_chunks[0]["embedding"]) != 1024:
            print(f"[JOB {job_id}] WARNING: Expected 1024 dim embedding, got {len(vector_chunks[0]['embedding'])}")

        # 5. Done
        print(f"[JOB {job_id}] --- PROCESS COMPLETE --- Sending final data to Spring Boot.")
        await send_callback(job_id, {
            "status": "done",
            "progress": 100,
            "step": None,
            "result": {
                "metadata": metadata,
                "analysis": analysis_result.model_dump(),
                "raw_transcript": transcript,
                "vector_chunks": vector_chunks
            }
        })
        
    except Exception as e:
        error_msg = str(e)
        print(f"\n[JOB {job_id}] !!! FATAL ERROR !!!")
        print(f"[JOB {job_id}] Exception Type: {type(e).__name__}")
        print(f"[JOB {job_id}] Error details: {error_msg}")
        if "403" in error_msg or "YouTube download failed" in error_msg:
            print(f"[JOB {job_id}] YT-DLP specific error caught (likely 403 Forbidden).")
            
        await send_callback(job_id, {"status": "error", "error": error_msg})
    finally:
        print(f"[JOB {job_id}] Cleaning up temp files...")
        try:
            if 'chunks' in locals() and chunks:
                cleanup_audio_files(chunks)
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except Exception as cleanup_error:
            print(f"[JOB {job_id}] Cleanup error: {cleanup_error}")


# ── Internal Endpoints ───────────────────────────────────────────────────────

@app.get("/internal/health", dependencies=[Depends(verify_internal_key)])
def health_check():
    return {"status": "ok", "role": "worker"}


@app.post("/internal/process-video", dependencies=[Depends(verify_internal_key)], status_code=202)
async def process_video(
    background_tasks: BackgroundTasks,
    job_id: str = Form(...),
    session_id: str = Form(...),
    source: Optional[str] = Form(None),
    audio_language: str = Form("auto"),
    summary_language: str = Form("english"),
    file: Optional[UploadFile] = File(None)
):
    """
    Accepts either a source URL or a file upload. Returns 202 Accepted immediately.
    Runs the heavy AI processing in the background and calls back Spring Boot.
    """
    if not source and not file:
        raise HTTPException(status_code=400, detail="Must provide either 'source' url or 'file'")

    file_path = None
    if file:
        # Save the uploaded file temporarily
        upload_dir = "downloades"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{job_id}_{file.filename}")
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

    background_tasks.add_task(
        process_video_background,
        job_id=job_id,
        session_id=session_id,
        source=source or "",
        audio_language=audio_language,
        summary_language=summary_language,
        file_path=file_path
    )
    
    return {"message": "Processing started in background"}


@app.post("/internal/chat", response_model=ChatResponse, dependencies=[Depends(verify_internal_key)])
def chat(req: ChatRequest):
    """
    Handles RAG chat. FastAPI connects to DB with read-only access (via psycopg2 directly or SQLAlchemy) 
    to fetch vectors, or Spring Boot sends them. 
    Wait, the plan said "FastAPI ko video_chunks pe read-only DB access do".
    Let's implement the pgvector similarity search here.
    """
    # 1. Embed the question
    embedder = get_embeddings()
    query_embedding = embedder.embed_query(req.question)
    
    # 2. Search pgvector for relevant chunks
    import psycopg2
    DB_URL = os.getenv("SUPABASE_DB_URL")
    if not DB_URL:
        raise HTTPException(status_code=500, detail="Worker DB URL not configured")
        
    context_text = ""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Convert list of floats to pgvector format '[f1, f2, ...]'
        emb_str = "[" + ",".join(map(str, query_embedding)) + "]"
        
        # HNSW cosine distance search (embedding <=> query)
        cur.execute("""
            SELECT chunk_text 
            FROM video_chunks 
            WHERE session_id = %s 
            ORDER BY embedding <=> %s::vector 
            LIMIT 4
        """, (req.session_id, emb_str))
        
        rows = cur.fetchall()
        if rows:
            context_text = "\n\n".join([row[0] for row in rows])
        else:
            context_text = "(No relevant context found in database.)"
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"DB search error: {e}")
        context_text = "(Error retrieving context from database.)"

    # 3. Generate answer
    try:
        answer = ask_question(
            context_text=context_text,
            question=req.question.strip(),
            history=req.history,
            language=req.language
        )
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
