"""
FastAPI Backend for AI Video Assistant
Replaces Streamlit's app.py — exposes the existing Python AI pipeline as REST APIs.
"""

from dotenv import load_dotenv
load_dotenv()

import os
import time
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from utils.audio_processor import process_input, cleanup_audio_files
from core.transcriber import transcribe_all
from core.summarizer import summarize, generate_title
from core.extractor import extract_action_items, extract_key_decisions, extract_questions
from core.rag_engine import build_rag_chain, ask_question

# ── App Setup ────────────────────────────────────────────────────────────────────
app = FastAPI(title="AI Video Assistant API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store for active sessions ──────────────────────────────────────────
sessions: dict = {}

# ── Request / Response Models ────────────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    source: str          # YouTube URL or local file path
    language: str = "english"  # "english" or "hinglish"

class ChatRequest(BaseModel):
    session_id: str
    question: str

class AnalyseResponse(BaseModel):
    session_id: str
    title: str
    transcript: str
    summary: str
    action_items: str
    key_decisions: str
    open_questions: str

class ChatResponse(BaseModel):
    answer: str

class HealthResponse(BaseModel):
    status: str
    version: str

# ── Endpoints ────────────────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    """Check if the server is alive."""
    return HealthResponse(status="ok", version="2.0.0")


@app.post("/api/analyse", response_model=AnalyseResponse)
def analyse_video(req: AnalyseRequest):
    """
    Run the full AI pipeline on a YouTube URL or local file.
    Returns title, transcript, summary, action items, decisions, questions.
    """
    if not req.source.strip():
        raise HTTPException(status_code=400, detail="Source URL or file path is required.")

    try:
        # Step 1: Audio processing
        print("[1/6] Audio processing...")
        chunks = process_input(req.source)

        # Step 2: Transcription
        print("[2/6] Transcription...")
        transcript = transcribe_all(chunks, req.language)

        # Cleanup: delete temporary audio files (no longer needed)
        cleanup_audio_files(chunks)

        # Step 3: Title generation
        print("[3/6] Generating title...")
        title = generate_title(transcript)
        time.sleep(2)

        # Step 4: Summarization
        print("[4/6] Summarizing...")
        summary = summarize(transcript)
        time.sleep(2)

        # Step 5: Extraction
        print("[5/6] Extracting insights...")
        action_items = extract_action_items(transcript)
        time.sleep(2)
        decisions = extract_key_decisions(transcript)
        time.sleep(2)
        questions = extract_questions(transcript)
        time.sleep(2)

        # Step 6: RAG engine
        print("[6/6] Building RAG engine...")
        rag_chain = build_rag_chain(transcript)

        # Store session for chat
        session_id = str(uuid.uuid4())[:8]
        sessions[session_id] = {
            "rag_chain": rag_chain,
            "title": title,
        }

        print(f"Pipeline complete! Session ID: {session_id}")

        return AnalyseResponse(
            session_id=session_id,
            title=title,
            transcript=transcript,
            summary=summary,
            action_items=action_items,
            key_decisions=decisions,
            open_questions=questions,
        )

    except Exception as e:
        print(f"Pipeline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat", response_model=ChatResponse)
def chat_with_meeting(req: ChatRequest):
    """Ask a question about a previously analysed meeting."""
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please analyse a video first.",
        )

    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        answer = ask_question(session["rag_chain"], req.question.strip())
        return ChatResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run Server ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
