# AI Video Assistant - Project Context Backup

This file serves as a persistent context backup to ensure we don't lose track of the project's architecture, decisions, and current state even if the chat resets.

## 1. Project Overview
- **Goal**: A web app where users can input a YouTube link or upload a video/audio file. The AI generates a summary, key points, and allows RAG-based chat (Q&A) against the video content.
- **Constraints**: No timestamps feature.

## 2. Tech Stack (Fixed & Locked)
- **Transcription**: Sarvam AI (`saaras:v4`, keyterms hint). *Whisper/Torch is strictly forbidden and removed.*
- **LLM**: Mistral (`ministral-8b-2512`, temperature 0.2).
- **Embeddings**: `mistral-embed` (1024-dimension).
- **Database**: Supabase Postgres + `pgvector` (`video_chunks` table, vector(1024), HNSW index, session_id FK ON DELETE CASCADE).
- **Frontend**: Next.js (2-pane layout, react-markdown).
- **Main Backend**: **Spring Boot 3.x (Java 17+)**. Handles users, jobs, history, chats, rate limiting, routing, and Clerk JWT auth (to be added last).
- **AI Workers**: **FastAPI** (two deployments: Local Laptop & Render Cloud).

## 3. Hybrid Deployment Strategy (Monorepo setup)
- **Local Laptop Worker** (via Ngrok): Dedicated to `yt-dlp` YouTube link downloads to bypass Render's IP blocks.
- **Render Cloud Worker**: Dedicated to processing direct file uploads and handling all RAG chat requests.
- **Spring Boot**: Hosted separately (can be Render or local), routes traffic between the two AI workers based on input type.

## 4. API Contracts & Rules
- **Endpoints (Spring Boot to Frontend)**:
  - `/api/metadata`, `/api/analyse`, `/api/status/{job_id}`, `/api/chat`, `/api/translate_overview`, `/api/history`, `/api/session/{id}`.
- **Job States**: `status` (queued|processing|done|error), `step` (downloading|transcribing|summarizing|indexing).
- **Security**: Python workers enforce `X-Internal-Key` validation. DB is accessed by workers in read-only mode for vectors (Spring Boot does all writes).
- **Error Handling**: No raw errors. Clean user-friendly exceptions (e.g. "YouTube link service is offline").

## 5. What has been done so far (Current State)
1. **AI Worker (Python)**:
   - `Requirements.txt` and `transcriber.py` completely purged of `torch` and `openai-whisper`.
   - Sarvam AI pipeline tested and verified successfully on Render via Postman (`202 Accepted` -> fast processing without OOM).
   - `/health` endpoint updated to be public.
2. **Spring Boot Backend**:
   - Initialized as a sub-folder (`spring-boot-backend`) within the main workspace (Monorepo style).
   - Created `Job.java` JPA Entity and `JobRepository.java`.
   - Created `AIWorkerRoutingService.java` for local worker health check and request routing.
   - Created `JobTimeoutService.java` (`@Scheduled` 10 min timeout).
   - Updated `application.properties` with Supabase pooler credentials and worker URLs.
   - Updated `VideoController.java` with JSON & Multipart support, result mapping on `done`, `/api/metadata` (OEmbed), and `/api/translate_overview`.
   - Configured Spring Boot `JdbcTemplate` for handling `pgvector` persistence (saving AI worker embeddings).
   - Created `ChatController.java` for `/api/chat` RAG endpoint forwarding.
   - **Status**: Live and running on port `8080`. Health check: `UP`.

3. **Frontend (Next.js)**:
   - Created `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8080`.
   - Running live on `http://localhost:3000` (Turbopack, HTTP 200).
   - **Theme Overhaul (Diglora Aesthetic)**: Deep eggplant/dark plum background (`#0D071B`), cyber gold accents (`#F2B824`), cream pill primary button, and tech geometric typography.
   - **No Emojis**: 100% of emojis removed across all components; replaced with sleek SVG vector icons.
   - Dual Input Mode Tabs in Left Pane: YouTube Link and Direct Upload (drag-and-drop dropzone, inline video/audio player preview).
   - Connected to Spring Boot endpoints for metadata preview, JSON/Multipart analyse submission, status polling, and chat.

## 6. Pending / Next Steps
1. Local Laptop Python Worker + Ngrok setup (so YouTube links can be processed locally to avoid Render IP blocks).
2. End-to-end video analysis test (YouTube link & file upload).
3. Clerk authentication integration (Final step).
