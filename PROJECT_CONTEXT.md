# AI Video Assistant - Project Context Backup

This file serves as a persistent context backup to ensure we don't lose track of the project's architecture, decisions, and current state.

## 1. Project Overview
- **Goal**: A web app where users can input a YouTube link or upload a video/audio file. The AI generates a summary, key points, and allows RAG-based chat (Q&A) against the video content.
- **Constraints**: No timestamps feature. Enterprise-grade architecture intended for CV showcasing.

## 2. Tech Stack (Fixed & Locked)
- **Transcription**: Sarvam AI (`saaras:v4`, keyterms hint).
- **LLM**: Mistral (`ministral-8b-2512`, temperature 0.2).
- **Embeddings**: `mistral-embed` (1024-dimension).
- **Database**: Supabase Postgres + `pgvector` (`video_chunks` table, vector(1024), HNSW index, session_id FK ON DELETE CASCADE).
- **Frontend**: Next.js (2-pane layout, react-markdown).
- **Main Backend**: **Spring Boot 3.x (Java 17+)**. Handles users, jobs, history, chats, rate limiting, routing, and Clerk JWT auth.
- **AI Workers**: **FastAPI** (two deployments: Local Laptop & Render Cloud).

## 3. Hybrid Deployment Strategy (Monorepo setup)
- **Local Laptop Worker** (via Ngrok): Dedicated to `yt-dlp` YouTube link downloads to bypass Render's IP blocks. Ngrok is set up with a static free domain.
- **Render Cloud Worker**: Dedicated to processing direct file uploads and handling all RAG chat requests.
- **Spring Boot (Render Cloud)**: Hosted on Render. Routes traffic between the two AI workers based on input type. Database connection pool size limited to 3 to adhere to Supabase's session limit of 15.
- **Next.js (Vercel)**: Hosted on Vercel with Environment Variables pointing to Clerk and the Spring Boot Render API.

## 4. API Contracts & Rules
- **Endpoints (Spring Boot to Frontend)**:
  - `/api/metadata`, `/api/analyse`, `/api/status/{job_id}`, `/api/chat`, `/api/translate_overview`, `/api/history`, `/api/session/{id}`, `/api/claim-history`.
- **Job States**: `status` (queued|processing|done|error), `step` (downloading|transcribing|summarizing|indexing).
- **Security & Reliability**:
  - Python workers enforce `X-Internal-Key` validation. 
  - DB is accessed by workers in read-only mode for vectors (Spring Boot does all writes).
  - Rate limiting via `Bucket4j` integrated in Spring Boot.
  - Hybrid Auth via Clerk: Users can analyze videos anonymously. Their session UUID is saved in local storage. When they sign in, `claim-history` assigns their anonymous DB records to their Clerk `userId`.

## 5. What has been done so far (Final State)
1. **AI Worker (Python)**:
   - File Upload worker running successfully on Render.
   - YouTube Local worker running locally with a static Ngrok domain.
2. **Spring Boot Backend**:
   - Deployed successfully on Render.
   - `application.properties` sanitized. Secrets moved to Render Environment Variables.
   - Fixed `HikariCP` max connection pool limit to `3` to resolve Supabase `FATAL: (EMAXCONNSESSION)` crashes.
   - Automated health checks and graceful degradation implemented (if local PC is down, YouTube links are disabled but File Uploads work).
3. **Frontend (Next.js)**:
   - Deployed successfully on Vercel.
   - **Theme Overhaul (Diglora Aesthetic)**: Deep eggplant/dark plum background (`#0D071B`), cyber gold accents (`#F2B824`), cream pill primary button, and tech geometric typography.
   - **No Emojis**: 100% of emojis removed across all components; replaced with sleek SVG vector icons.
   - Complete layout overhaul fixing scrollbars and box sizing.
   
## 6. Pending / Next Steps
- ALL CORE DEVELOPMENT & DEPLOYMENT COMPLETE. 🎉
- Project is ready for CV presentation and LinkedIn demo video.
