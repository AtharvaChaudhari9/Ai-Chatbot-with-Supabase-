# Project Summary: Architecture & Features Cheat Sheet

This document serves as an **Executive Summary and Elevator Pitch Cheat Sheet** for the AI Chatbot project. It aggregates the development history stages and system functionalities in a concise, visual format, making it perfect for last-minute review before an interview.

---

## 🗺️ Visual Architecture Roadmap

The diagram below maps out how the system evolved from a cloud-coupled monolithic MVP into a containerized, hybrid cloud/local RAG system:

```
 [Phase 1: Cloud MVP]
 +------------------+     HTTP/REST     +------------------+
 | Next.js Frontend | <===============> |   Supabase DB    |
 +--------+---------+                   +------------------+
          |
          | Direct API Call
          v
 +--------+---------+
 | Gemini Cloud API |
 +------------------+
          |
          | (Migrated to security & local stack)
          v
 [Phase 2: Security & Local Focus]
 +--------------------+                  +------------------+
 |    Google Auth     | ===(JWT Auth)==> | Next.js Frontend |
 +--------------------+                  +--------+---------+
                                                  |
                  +-------------------------------+---------------+
                  | (Local Switching)                             | (Vector Storage)
                  v                                               v
 +----------------+---+                                 +---------+--------+
 | Ollama Integration |                                 | Supabase pgvector|
 +--------------------+                                 +------------------+
          |
          | (Decoupled & optimized vector architecture)
          v
 [Phase 3: Decoupled & Optimized (Current State)]
                         +--------------------+
                         |  Next.js Frontend  |
                         | (Authentication &  |
                         |    Chat History)   |
                         +---------+----------+
                                   |
                                   | (Internal API Router)
                                   v
                         +--------------------+
                         |  FastAPI Backend   |
                         |  (Python Service)  |
                         +----+----+----+-----+
                              |    |    |
             +----------------+    |    +-----------------+
             | (Extract/OCR)       | (Vector Queries)     | (LLM Inference)
             v                     v                      v
      +------+-----+        +------+------+        +------+------+
      |  PyMuPDF   |        |  Qdrant DB  |        |  Ollama LLM |
      |  & Surya   |        | (Rust Vector|        | (CUDA GPU   |
      |  (Text)    |        |   Engine)   |        | Acceleration|
      +------------+        +-------------+        +-------------+
```

---

## ⚡ The 60-Second Interview Elevator Pitch

> *"I designed and built a containerized, multi-tenant Retrieval-Augmented Generation (RAG) chatbot platform that supports hybrid cloud/local LLM providers (Google Gemini API & local Ollama). The project evolved from a Next.js MVP into a decoupled microservices architecture to solve performance bottlenecks. I moved compute-heavy tasks like scanned PDF parsing and Surya OCR processing to a dedicated Python FastAPI backend, and offloaded embeddings storage from a relational database (Supabase pgvector) to a specialized Rust-based vector search engine (Qdrant). The entire stack is containerized using Docker Compose, leveraging WSL2 and the NVIDIA Container Toolkit for local GPU-accelerated model execution."*

---

## 📋 Architectural Stages (In Short)

1.  **Stage 1: Core MVP**: Simple chatbot connecting Next.js directly to the cloud Gemini API; chats and messages persisted in Supabase.
2.  **Stage 2: Auth & Security**: Integrated Google OAuth and configured PostgreSQL **Row Level Security (RLS)** to enforce strict multi-tenant boundaries at the database engine level.
3.  **Stage 3: Local LLMs**: Integrated local Ollama endpoints to switch to free, offline models, reducing cloud billing and avoiding API rate limits.
4.  **Stage 4: Initial RAG**: Enabled file uploads using Supabase Storage and `pgvector` for indexing document chunks.
5.  **Stage 5: FastAPI Backend Decoupling**: Decoupled the ingestion pipeline to a FastAPI backend. This solved Next.js (Node.js) single-threaded UI freezes caused by heavy document extraction and Surya OCR execution.
6.  **Stage 6: Qdrant Vector DB Migration**: Migrated embedding vectors from PostgreSQL to Qdrant. This resolved database index bloat and allowed sub-millisecond, graph-based (HNSW) similarity searches with user metadata filtering.
7.  **Stage 7: Docker Containerization**: Configured multi-container builds with Docker Compose, utilizing Docker's internal DNS network for service discovery and mounting local NVIDIA GPU drivers into the Ollama container for accelerated inference.
8.  **Stage 8: AWS Cloud Deployment**: Deployed containerized applications to AWS EC2 instance, configuring Nginx as a reverse proxy, SSL certificates via Certbot, and dynamic subdomains via DuckDNS. Integrated `ssh-cognexa.bat` and `ssh_config.txt` shell config tools to automate terminal access.
9.  **Stage 9: Automated CI/CD Pipeline**: Configured GitHub Actions workflows to compile Docker images on remote runners, push to GitHub Container Registry (GHCR), and safely pull/reboot on EC2 via SSH. Added `git-deploy.bat` to automate local Git pushes and trigger pipeline runs instantly.
10. **Stage 10: Keycloak OIDC & NextAuth Migration**: Replaced third-party SaaS auth (Supabase Auth) with a containerized Keycloak instance running locally. Integrated NextAuth middleware and custom token mappings to link stable deterministic UUIDs.
11. **Stage 11: In-App User Profile Customization**: Integrated custom Supabase profile schema and server-side pre-fetching (using the admin client) to prevent profile picture flicker during page load.
12. **Stage 12: In-App Two-Factor Authentication (MFA)**: Built pure-JS RFC-6238 TOTP verification, GoQR code layouts, and custom stacked modals to enforce 2FA session locks natively.
13. **Stage 13: Production Standalone Build Tuning**: Configured Next.js standalone builds and `.dockerignore` context filters to optimize EC2 compilation times.

---

## ⚙️ Core System Functionalities (In Short)

### 1. Multi-Tenant Authentication & Session Management
*   **How it works**: Users authenticate via Google OIDC or local credentials managed by a self-hosted Keycloak instance. Session states are securely held by NextAuth v5 client-side cookies with deterministic user ID mappings to allow smooth history persistence.
*   **Key Tech**: Keycloak OIDC, NextAuth v5, Postgres RLS (`session.user.id = user_id`).

### 2. Live Chat Streaming
*   **How it works**: Next.js streams response tokens as they generate from either cloud or local models to reduce Time to First Token (TTFT).
*   **Key Tech**: React State + Server-Sent Events (`ReadableStream`).

### 3. OCR Document Ingestion Pipeline
*   **How it works**: Uploaded PDFs/images are processed by the FastAPI backend. Text is extracted digitally via PyMuPDF. If the file is scanned/image-only, the backend triggers Surya OCR to generate a machine-readable text layer.
*   **Key Tech**: FastAPI, PyMuPDF, Surya OCR.

### 4. Vector Embedding & Filtering (RAG)
*   **How it works**: Text is divided using recursive character chunking. Chunks are embedded using `nomic-embed-text` and stored in Qdrant. Search queries generate a query vector and search Qdrant filtered by `user_id` and `document_id`.
*   **Key Tech**: Qdrant HNSW indexing, LangChain Splitter, Ollama.

### 5. GPU Container Acceleration
*   **How it works**: Renders Ollama execution fast by mapping the host's physical GPU cores directly inside the containerized Docker network.
*   **Key Tech**: NVIDIA Container Toolkit, Docker GPU Reservations.

### 6. Automated CI/CD Pipeline
*   **How it works**: Automatically builds frontend and backend Docker containers in GitHub Actions runners on push to main, pushes to GitHub Container Registry (GHCR), and pulls/restarts them on EC2 over SSH.
*   **Key Tech**: GitHub Actions, GHCR, SSH-deploy, Docker Compose.

### 7. User Profile Settings & Server Hydration
*   **How it works**: Allows users to customize display nicknames and upload profile pictures. Hydrates layout properties on the server side using the service role client (`createAdminClient()`) to bypass relational RLS checks, eliminating initials placeholder rendering lag.
*   **Key Tech**: Supabase Profiles database schema, Next.js Server Components, Base64 uploads.

### 8. In-App Two-Factor Authentication (MFA)
*   **How it works**: Secures user accounts via standard TOTP. Generates secret keys in-app, displays dynamic GoQR setup links, verifies codes via purely client-side RFC 6238 look-ahead windows, and enforces full-screen session-locked input cards using `sessionStorage` (cleared on logout).
*   **Key Tech**: Node `crypto` algorithms, sessionStorage, stackable modal overlays.

### 9. Standalone Container Performance Tuning
*   **How it works**: Bypasses compiler type-checks during Docker container assembly. Employs Next.js Standalone builds to trace runtime files and compile compact packages (~30MB instead of 500MB+ node_modules), cutting EC2 context transfer and export times down to 1s.
*   **Key Tech**: Next.js Standalone Output, `.dockerignore` filters.

---

## 📐 RAG & Ingestion Data Flow Diagram

The diagram below visualizes the complete end-to-end data lifecycle of a document upload and subsequent search query in the RAG pipeline:

```
 User Browser          Next.js FE          FastAPI BE          Supabase DB         Qdrant DB          Ollama
      |                    |                    |                   |                  |                 |
      |=== Ingestion Flow ===================================================================================|
      |                    |                    |                   |                  |                 |
      |-- Upload File ---->|                    |                   |                  |                 |
      |                    |-- Save File ------>|                   |                  |                 |
      |                    |   & metadata       |                   |                  |                 |
      |                    |                    |                   |                  |                 |
      |                    |-- Trigger Ingest ->|                   |                  |                 |
      |                    |   (user/doc_id)    |-- Read File ----->|                  |                 |
      |                    |                    |   bytes           |                  |                 |
      |                    |                    |                   |                  |                 |
      |                    |                    |-- Extract text ---|                  |                 |
      |                    |                    |   (PDF/OCR)       |                  |                 |
      |                    |                    |                   |                  |                 |
      |                    |                    |-- Chunk text -----|                  |                 |
      |                    |                    |                   |                  |                 |
      |                    |                    |-- For each chunk: |                  |                 |
      |                    |                    |   Generate vector |=================>|                 |
      |                    |                    |   (nomic-embed)   |<=================|                 |
      |                    |                    |                   |                  |                 |
      |                    |                    |-- Insert vector -------------------->|                 |
      |                    |                    |   & payload       |                  |                 |
      |                    |<-- Ingest OK ------|                   |                  |                 |
      |<-- Ready ----------|                    |                   |                  |                 |
      |                    |                    |                   |                  |                 |
      |=== Retrieval-Augmented Chat Flow ====================================================================|
      |                    |                    |                   |                  |                 |
      |-- Prompt --------->|                    |                   |                  |                 |
      |                    |-- Query context -->|                   |                  |                 |
      |                    |   (prompt/user_id) |-- Generate vector ==================>|                 |
      |                    |                    |   (query embedding) <================|                 |
      |                    |                    |                   |                  |                 |
      |                    |                    |-- Similarity Search ---------------->|                 |
      |                    |                    |   (filtered search) <----------------|                 |
      |                    |                    |                                      |                 |
      |                    |<-- Contexts -------|                                      |                 |
      |                    |                                                           |                 |
      |                    |-- Context + Prompt -------------------------------------------------------->|
      |                    |   (LLM Chat Query)                                                          |
      |                    |<-- Stream tokens -----------------------------------------------------------|
      |<-- Stream text ----|                                                           |                 |
      |                    |                    |                   |                  |                 |
```
