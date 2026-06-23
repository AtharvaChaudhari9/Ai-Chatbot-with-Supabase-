# Chatbot Features & Functionality Manual

This document details every feature and core functionality implemented in the **AI Chatbot Platform**. It explains how each feature works under the hood, how the implementation evolved over time, and the technical rationale behind every change.

---

## 📂 Table of Features

1. [Interactive Chat Interface & Streaming](#1-interactive-chat-interface--streaming)
2. [Google Authentication & Multi-Tenancy](#2-google-authentication--multi-tenancy)
3. [Hybrid LLM Provider Selection (Cloud vs. Local)](#3-hybrid-llm-provider-selection-cloud-vs-local)
4. [Document Management & Storage](#4-document-management--storage)
5. [OCR-Enabled Ingestion Pipeline](#5-ocr-enabled-ingestion-pipeline)
6. [Vector Storage & Retrieval-Augmented Generation (RAG)](#6-vector-storage--retrieval-augmented-generation-rag)
7. [Unified Service Orchestration (Docker Compose)](#7-unified-service-orchestration-docker-compose)

---

## 1. Interactive Chat Interface & Streaming

### 📝 Description
Provides a real-time, responsive chat interface where users can type messages, view history, and receive streamed responses from the active language model.

### ⚙️ Technical Implementation
*   **Frontend UI**: React state management hooks to stream chunks from the API routes using `ReadableStream` and the Fetch API.
*   **Relational Storage**: Relational tables in Supabase:
    *   `chats`: Stores session metadata (`id`, `title`, `user_id`, `created_at`).
    *   `messages`: Stores individual dialogue turns (`id`, `chat_id`, `user_id`, `role`, `content`, `created_at`).

### 🔄 What Changed & Why?
*   **Initial State**: Standard HTTP JSON POST responses. The UI waited for the LLM to generate the entire response before displaying anything.
*   **Current State**: Token-by-token streaming using Server-Sent Events (SSE) / chunked transmission.
*   **Rationale (Why)**: Streaming reduces **Time to First Token (TTFT)**. Even if an LLM takes 30 seconds to generate a complete answer, displaying the first words within 500ms makes the application feel immediate and responsive, drastically improving user experience.

---

## 2. Google Authentication & Multi-Tenancy

### 📝 Description
Enables users to sign in securely using their Google accounts. The system guarantees complete isolation of data—users can only access their own chats, messages, and uploaded files.

### ⚙️ Technical Implementation
*   **Authentication**: Supabase Auth client library handles Google OAuth redirection.
*   **Security Layer**: PostgreSQL **Row Level Security (RLS)** is enabled on all tables in Supabase.
*   **RLS Policies**:
    ```sql
    -- Example for the 'chats' table
    CREATE POLICY "Users can only manage their own chats" 
    ON public.chats 
    FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id);
    ```

### 🔄 What Changed & Why?
*   **Initial State**: Unauthenticated, single-user system. All data was global.
*   **Current State**: Strict multi-tenant authentication utilizing Supabase Auth JWTs.
*   **Rationale (Why)**: Security compliance and scale. Multi-tenancy prevents cross-user data leakage. Using RLS delegates authentication checks to the database layer, creating a bulletproof security perimeter that persists regardless of frontend software bugs.

---

## 3. Hybrid LLM Provider Selection (Cloud vs. Local)

### 📝 Description
Allows users to toggle the active language model in the settings pane on the fly. The application dynamically switches between cloud-based models (Google Gemini API) and self-hosted models (via Ollama running locally).

### ⚙️ Technical Implementation
*   **Active Selection Hook**: A global React state variable or session state determines the model route.
*   **Local Auto-Detection**: Next.js api routes query `http://ai-chatbot-ollama:11434/api/tags` to list downloaded local models dynamically.
*   **API Router**:
    *   If Gemini: Proxy query to the `@google/generative-ai` SDK using `process.env.GEMINI_API_KEY`.
    *   If Ollama: Send API payload directly to `http://ai-chatbot-ollama:11434/api/generate` or `chat`.

### 🔄 What Changed & Why?
*   **Initial State**: Hardcoded Gemini API cloud calls.
*   **Current State**: Dynamic provider adapter pattern (Gemini vs. Ollama).
*   **Rationale (Why)**:
    1.  **Cost Controls**: Heavy test-runs are executed locally on Ollama for free, saving Gemini API tokens.
    2.  **Robustness**: System remains operational without internet connections (using local LLM fallback).
    3.  **Privacy**: Sensitive documents can be processed entirely locally.

---

## 4. Document Management & Storage

### 📝 Description
Allows users to upload documents (PDFs, images, text files) to enrich their chats with dynamic context, and delete them when they are no longer needed.

### ⚙️ Technical Implementation
*   **Storage**: Supabase Storage Buckets (`documents` bucket) store the raw files.
*   **Database Tracking**: A Supabase table `documents` tracks document state, ownership (`user_id`), and metadata.
*   **Deletion Lifecycle**:
    1.  User clicks delete in the UI.
    2.  API requests backend to remove vectors from Qdrant.
    3.  API requests Supabase to delete the database reference and the file from the Storage Bucket.

### 🔄 What Changed & Why?
*   **Initial State**: Direct uploads to Next.js API temp directories.
*   **Current State**: Centrally stored objects in Supabase Storage Buckets coupled with database-tracked metadata.
*   **Rationale (Why)**: Ephemeral container filesystems lose data on container rebuilds. Supabase Storage provides a persistent, scalable, and secure blob storage layer that behaves consistently across deployments.

---

## 5. OCR-Enabled Ingestion Pipeline

### 📝 Description
Takes uploaded documents, parses their layout, extracts textual content (even from scanned PDFs or images), chunks the text, and produces vector representations.

### ⚙️ Technical Implementation
*   **Compute Engine**: FastAPI backend service running Python 3.12.
*   **Libraries**:
    *   `PyMuPDF` (`fitz`): Fast digital PDF parsing.
    *   `Surya OCR`: Deep learning-based OCR engine used as a fallback to extract text from image-only PDFs.
    *   `LangChain RecursiveCharacterTextSplitter`: Chunks extracted text while preserving semantic paragraphs.
*   **Embeddings Generation**: Sends text chunks to Ollama's `nomic-embed-text` endpoint inside the container network.

### 🔄 What Changed & Why?
*   **Initial State**: Written in Next.js Server Actions using simple JavaScript regex-based text splitters.
*   **Current State**: Extracted to FastAPI backend with deep learning OCR dependencies.
*   **Rationale (Why)**: Next.js is built on Node.js which is single-threaded and struggles with heavy compute operations like OCR text detection and tokenization. A dedicated Python backend allowed the leverage of the rich Python ML ecosystem (PyMuPDF, Torch, Surya) and isolates heavy compute workloads from user interactions.

---

## 6. Vector Storage & Retrieval-Augmented Generation (RAG)

### 📝 Description
Retrieves contextually relevant document sections based on user prompts, injecting them into the LLM system prompt to generate factually accurate answers.

### ⚙️ Technical Implementation
*   **Vector Engine**: Qdrant running in a standalone container.
*   **Search Flow**:
    1.  User prompt is vector-embedded via Ollama.
    2.  Qdrant queries the vector using cosine similarity.
    3.  A filter is applied to match `user_id` and `document_id`.
    4.  Returned chunks are joined as system instructions for the LLM.

### 🔄 What Changed & Why?
*   **Initial State**: Chunks and embeddings were stored inside Supabase using `pgvector`.
*   **Current State**: Vectors, payloads, and embeddings are isolated in **Qdrant Vector DB**.
*   **Rationale (Why)**:
    1.  **Scale**: Supabase transactional PostgreSQL queries were slowed down by heavy vector indices.
    2.  **Query Speed**: Qdrant's HNSW graph-indexing runs searches in sub-milliseconds.
    3.  **Strict Isolation**: Supabase handles transactional database tasks, Qdrant handles intensive multidimensional searches, keeping core database memory loads low.

---

## 7. Unified Service Orchestration (Docker Compose)

### 📝 Description
Packs the Next.js frontend, FastAPI backend, Qdrant database, and Ollama runner into Docker containers, establishing a network for communication.

### ⚙️ Technical Implementation
*   **Compose Setup**: `docker-compose.yml` defining four main containers:
    *   `frontend` (Next.js Multi-stage build)
    *   `backend` (FastAPI Python build)
    *   `qdrant` (Qdrant Vector database)
    *   `ollama` (Ollama engine configured with CUDA bindings)
*   **Volume Mounts**:
    *   `qdrant_storage`: Persistent volume for vectors.
    *   `ollama_models`: Persistent volume for local LLM weights.

### 🔄 What Changed & Why?
*   **Initial State**: Manual runtime installation (Node local environment, global Python dependencies, running Ollama desktop app, installing local Postgres extensions).
*   **Current State**: Single commands `docker compose up --build` launches the isolated stack.
*   **Rationale (Why)**: Solved local dependency conflicts. Isolating applications in containers guarantees they run exactly the same way on any development machine or production cloud instance without installation headaches.

---

## 📈 Future Feature Expansion Framework

If you need to implement a new feature moving forward, follow this blueprint to maintain structural integrity and update this document:

```
                   +-----------------------+
                   |   New Feature Idea    |
                   +-----------+-----------+
                               |
                               v
               +---------------+---------------+
               |  What layer does it affect?   |
               +-------+---+---+---+---+-------+
                       |   |   |   |
      +----------------+   |   |   +----------------+
      | (UI & Routing)     |   |     (Vector Search)|
      v                    |   |                    v
+-----+----------+         |   |         +----------+-----+
| Modify Next.js |         |   |         | Create Qdrant  |
| Frontend       |         |   |         | Colls/Payloads |
+-----+----------+         |   |         +----------+-----+
      |                    |   |                    |
      |      (Data Schema) |   | (AI Processing)    |
      |      +-------------+   +-------------+      |
      |      v                               v      |
      |  +---+------------+             +----+---+  |
      |  | Update Supabase|             | Update |  |
      |  | SQL / RLS      |             | FastAPI|  |
      |  +---+------------+             +----+---+  |
      |      |                               |      |
      +------+---------------+---------------+------+
                             |
                             v
               +-------------+-------------+
               | Test functionality locally |
               +-------------+-------------+
                             |
                             v
               +-------------+-------------+
               | Update docker-compose.yml |
               |  (if dependencies added)  |
               +-------------+-------------+
                             |
                             v
               +-------------+-------------+
               |        Document in        |
               | FEATURES_AND_FUNCTIONALITY|
               +---------------------------+
```

### Update template for future features:
```markdown
## [Feature Number]. [Feature Name]

### 📝 Description
[High-level overview of what the feature does.]

### ⚙️ Technical Implementation
*   **Modules/Libraries**: [What code files or libraries did you write or use?]
*   **Database/Vector Changes**: [New SQL tables, columns, or Qdrant payloads.]

### 🔄 What Changed & Why?
*   **Initial State**: [How the app behaved prior to this change.]
*   **Current State**: [How the app behaves now.]
*   **Rationale (Why)**: [Why this architectural shift was made (performance, security, scalability).]
```
