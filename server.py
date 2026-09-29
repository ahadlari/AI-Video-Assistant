"""
FastAPI Backend for AI Video Assistant
"""

from dotenv import load_dotenv
load_dotenv()

import os
import time
import uuid
import asyncio
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Literal

from utils.audio_processor import process_input, cleanup_audio_files
from core.transcriber import transcribe_all
from core.summarizer import analyze_video
from core.rag_engine import build_rag_chain, ask_question
from core.video_info import get_video_metadata
from core.models import VideoAnalysisResult

# ── App Setup ────────────────────────────────────────────────────────────────────
app = FastAPI(title="AI Video Assistant API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory stores ─────────────────────────────────────────────────────────────
# Cache: url -> { 'transcript': str, 'analysis': dict, 'rag_chain': object, 'metadata': dict }
url_cache: Dict[str, Any] = {}

# Jobs: job_id -> JobStatus state
jobs: Dict[str, Any] = {}

# Sessions for Chat: session_id -> { 'rag_chain': object, 'source': str, 'analysis': dict }
sessions: Dict[str, Any] = {}

# ── Request / Response Models ────────────────────────────────────────────────────
class MetadataRequest(BaseModel):
    source: str

class MetadataResponse(BaseModel):
    title: str
    channel: str
    duration: int
    thumbnail: Optional[str]

class AnalyseRequest(BaseModel):
    source: str
    audio_language: str = "auto" # "auto", "english", "hindi", "hinglish"
    summary_language: str = "english" # "english", "hindi", "hinglish"

class JobResponse(BaseModel):
    job_id: str

class AnalysisResultWithSession(VideoAnalysisResult):
    session_id: str
    source: str

class JobStatusResponse(BaseModel):
    status: Literal["queued", "processing", "done", "error"]
    step: Optional[Literal["downloading", "transcribing", "summarizing", "indexing"]] = None
    progress: int = 0
    result: Optional[AnalysisResultWithSession] = None
    error: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: str
    question: str
    language: str = "english"
    history: List[dict] = []

class ChatResponse(BaseModel):
    answer: str

class TranslateRequest(BaseModel):
    session_id: str
    target_language: str
    
class HistoryItem(BaseModel):
    session_id: str
    source: str
    title: str
    tldr: str
    thumbnail: Optional[str]
    channel: Optional[str]
    created_at: str

# ── Endpoints ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}

@app.post("/api/metadata", response_model=MetadataResponse)
def get_metadata(req: MetadataRequest):
    if not req.source.strip():
        raise HTTPException(status_code=400, detail="Source URL is required.")
    metadata = get_video_metadata(req.source)
    if not metadata["title"] or metadata["title"] == "Unknown Title":
        raise HTTPException(status_code=404, detail="Invalid video URL or video is private.")
    return metadata

def process_video_task(job_id: str, source: str, audio_language: str, summary_language: str):
    try:
        jobs[job_id]["status"] = "processing"
        
        # Check cache first
        if source in url_cache:
            jobs[job_id]["step"] = "indexing"
            jobs[job_id]["progress"] = 100
            
            cached_data = url_cache[source]
            session_id = str(uuid.uuid4())[:8]
            sessions[session_id] = {
                "rag_chain": cached_data["rag_chain"],
                "source": source,
                "analysis": cached_data["analysis"],
                "metadata": cached_data["metadata"]
            }
            
            jobs[job_id]["status"] = "done"
            jobs[job_id]["result"] = {
                "session_id": session_id,
                "source": source,
                **cached_data["analysis"]
            }
            return

        # Fetch metadata for history
        metadata = get_video_metadata(source)
        if not metadata["title"] or metadata["title"] == "Unknown Title":
            raise Exception("Invalid video URL or video is private.")

        # 1. Downloading & Audio Processing
        jobs[job_id]["step"] = "downloading"
        jobs[job_id]["progress"] = 10
        chunks = process_input(source)

        # 2. Transcription
        jobs[job_id]["step"] = "transcribing"
        jobs[job_id]["progress"] = 40
        transcript = transcribe_all(chunks, audio_language, metadata)
        cleanup_audio_files(chunks)

        # 3. LLM Analysis (Structured JSON)
        jobs[job_id]["step"] = "summarizing"
        jobs[job_id]["progress"] = 70
        analysis_result = analyze_video(transcript, summary_language, metadata)
        analysis_dict = analysis_result.model_dump()

        # 4. RAG Indexing
        jobs[job_id]["step"] = "indexing"
        jobs[job_id]["progress"] = 90
        rag_chain = build_rag_chain(transcript)

        # Update Cache
        url_cache[source] = {
            "transcript": transcript,
            "analysis": analysis_dict,
            "rag_chain": rag_chain,
            "metadata": metadata
        }

        # Setup session for chat
        session_id = str(uuid.uuid4())[:8]
        sessions[session_id] = {
            "rag_chain": rag_chain,
            "source": source,
            "analysis": analysis_dict,
            "metadata": metadata,
            "created_at": datetime.utcnow().isoformat()
        }

        # Complete Job
        jobs[job_id]["progress"] = 100
        jobs[job_id]["step"] = None
        jobs[job_id]["status"] = "done"
        jobs[job_id]["result"] = {
            "session_id": session_id,
            "source": source,
            **analysis_dict
        }

    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)

@app.post("/api/analyse", response_model=JobResponse)
def analyse_video(req: AnalyseRequest, background_tasks: BackgroundTasks):
    if not req.source.strip():
        raise HTTPException(status_code=400, detail="Source URL is required.")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "queued",
        "step": None,
        "progress": 0,
        "result": None,
        "error": None
    }
    
    background_tasks.add_task(process_video_task, job_id, req.source.strip(), req.audio_language, req.summary_language)
    return JobResponse(job_id=job_id)

@app.get("/api/status/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/api/history", response_model=List[HistoryItem])
def get_history():
    history = []
    for sid, data in sessions.items():
        history.append({
            "session_id": sid,
            "source": data["source"],
            "title": data["analysis"]["title"],
            "tldr": data["analysis"]["tldr"],
            "thumbnail": data["metadata"].get("thumbnail"),
            "channel": data["metadata"].get("channel"),
            "created_at": data.get("created_at", "")
        })
    return history

@app.get("/api/session/{session_id}", response_model=AnalysisResultWithSession)
def get_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "source": session["source"],
        **session["analysis"]
    }

@app.post("/api/chat", response_model=ChatResponse)
def chat_with_video(req: ChatRequest):
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        answer = ask_question(
            session["rag_chain"],
            req.question.strip(),
            history=req.history[-6:] if req.history else [],
            language=req.language
        )
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translate_overview")
def translate_overview(req: TranslateRequest):
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    # Check cache
    if "translations" not in session:
        session["translations"] = {}
        # The initial summary is effectively the first translation
        # But we don't know the exact language it was generated in here easily,
        # so we'll just let Mistral translate it if requested.
        
    if req.target_language in session["translations"]:
        return session["translations"][req.target_language]
        
    try:
        from core.summarizer import translate_analysis
        new_analysis = translate_analysis(session["analysis"], req.target_language)
        session["translations"][req.target_language] = new_analysis
        return new_analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
