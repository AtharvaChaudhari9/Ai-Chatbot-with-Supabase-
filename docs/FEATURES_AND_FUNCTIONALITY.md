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
8. [Custom Specialized Agents](#8-custom-specialized-agents)
9. [Secure Production Deployment (AWS EC2 & Nginx)](#9-secure-production-deployment-aws-ec2--nginx)
10. [Automated CI/CD Pipeline (GitHub Actions & GHCR)](#10-automated-cicd-pipeline-github-actions--ghcr)
11. [In-App User Profile Customization](#11-in-app-user-profile-customization)
12. [In-App Two-Factor Authentication (MFA/2FA)](#12-in-app-two-factor-authentication-mfa2fa)
13. [OIDC Identity Mapping & Keycloak Theme Overrides](#13-oidc-identity-mapping--keycloak-theme-overrides)
14. [Next.js Standalone Build & EC2 Performance Tuning](#14-nextjs-standalone-build--ec2-performance-tuning)

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

## 8. Custom Specialized Agents

### 📝 Description
Allows users to create, customize, and chat with specialized AI assistants. Each agent has its own specific system instructions, model preferences (Gemini vs. Local), description, avatar, and conversation starters.

### ⚙️ Technical Implementation
*   **Database Schema**: A relational table `custom_agents` in Supabase with RLS enabled:
    *   `id`, `user_id` (foreign key to auth.users), `name`, `description`, `system_prompt`, `preferred_model` (gemini/local), `local_model_name`, `avatar_url`, `conversation_starters` (text array).
*   **API Routes**: Next.js App Router API endpoints:
    *   `GET /api/agents` & `POST /api/agents`: Retrieve and create custom agents.
    *   `GET /api/agents/[id]` & `DELETE /api/agents/[id]`: Retrieve and delete specific agents.
    *   `POST /api/agents/generate-starters`: Uses LLM to dynamically generate context-relevant starter prompts for new agents.
*   **UI Components**:
    *   `AgentModal.tsx`: Interactive dashboard to configure agent metadata, choose avatar icons/emojis, and customize instructions.
    *   `Sidebar.tsx`: Integrates agents list under "Specialized Agents" header with expand/collapse states for agent-specific chat histories.

### 🔄 What Changed & Why?
*   **Initial State**: Standard general chatbot interface. All chats used a single generic assistant model with standard settings.
*   **Current State**: Multi-agent framework where users can spin up separate assistants for different roles (e.g. "Python Coding Tutor", "Marketing Copywriter") with custom instructions.
*   **Rationale (Why)**: Custom prompts enable personalization. By locking specific system prompts, configuration settings, and model preferences into an agent record, users don't need to re-type context rules for every new chat, improving productivity.

---

## 9. Secure Production Deployment (AWS EC2 & Nginx)

### 📝 Description
Exposes the dockerized chatbot stack securely on a public-facing AWS EC2 instance over HTTPS, utilizing Nginx as a reverse proxy and Let's Encrypt (Certbot) for encryption.

### ⚙️ Technical Implementation
*   **Infrastructure**: AWS EC2 instance running Amazon Linux, secured with inbound Security Group rules restricting public access to Ports 80 (HTTP) and 443 (HTTPS) only.
*   **Reverse Proxy**: Nginx installed on the host OS routing Port 80/443 traffic to Next.js on localhost Port 3000.
*   **Header Buffering**: Customized Nginx location block to resolve the `upstream sent too big header` proxy limit using:
    ```nginx
    proxy_buffer_size          128k;
    proxy_buffers              4 256k;
    proxy_busy_buffers_size    256k;
    ```
*   **SSL/TLS Certificate**: Let's Encrypt certificates managed by Certbot, mapped to a free dynamic subdomain from DuckDNS (`cognexa-ai.duckdns.org`).
*   **Resource Tuning**: Added a 4GB Swap file to prevent the 1GB RAM EC2 server from experiencing Out of Memory (OOM) failures during compiler steps.

### 🔄 What Changed & Why?
*   **Initial State**: Localhost-only deployment (`http://localhost:3000`) with raw container ports exposed directly on local interfaces.
*   **Current State**: Secure cloud-native deployment accessible via `https://cognexa-ai.duckdns.org`.
*   **Rationale (Why)**: Accessing the app over the web requires cloud hosting. Nginx acts as a security perimeter, ensuring database endpoints (Qdrant, Ollama, FastAPI) remain private, while Certbot secures user logins and chat inputs in transit.

---

## 10. Automated CI/CD Pipeline (GitHub Actions & GHCR)

### 📝 Description
Automates code testing, container compilation, and cloud deployment. Every push to the `main` branch on GitHub triggers remote CI runners to compile Docker containers, publish them to the GitHub Container Registry (GHCR), and securely deploy them to the AWS EC2 production instance.

### ⚙️ Technical Implementation
*   **Workflow Engine**: GitHub Actions using the [.github/workflows/deploy.yml](file:///c:/Users/cdrja/Desktop/chatbot-supabase/.github/workflows/deploy.yml) configuration.
*   **Compilation Environment**: Remote Ubuntu runners executing Docker Buildx with cache optimization enabled (`type=gha`).
*   **Artifact Registry**: GitHub Container Registry (`ghcr.io`) hosting private package images.
*   **Deployment Hook**: SSH connection executed via `appleboy/ssh-action` connecting to EC2 on Port 22 using a repository SSH key, pulling latest changes, logging into GHCR, pulling the pre-built packages, restarting containers, and pruning stale layers.

### 🔄 What Changed & Why?
*   **Initial State**: Manual deployment: developers SSH'ed into EC2, ran `git pull`, and executed `docker-compose up --build`.
*   **Current State**: Full Git-triggered remote compilation and automatic deployment.
*   **Rationale (Why)**: 
    1.  **Server Protection**: Running local webpack compiles and pip compilations on a Free Tier EC2 instance (1GB RAM) spikes the single-core CPU to 100%, causing OOM page faults and crashing active chatbot sessions. Offloading compiles to GitHub Action runners ensures the server remains responsive.
    2.  **Low-Downtime Reboots**: Pulling pre-compiled Docker packages takes only a few seconds, reducing redeployment downtime from several minutes to under 15 seconds.
    3.  **Clean State Packaging**: Using registry-based images eliminates the need to compile code locally, guaranteeing identical builds between development and production environments.

---

---

## 11. In-App User Profile Customization

### 📝 Description
Enables users to customize their profile settings (nickname, custom base64-encoded avatar uploads) directly inside the chatbot settings gear panel. To prevent rendering flicker on startup, layout props are hydrated server-side.

### ⚙️ Technical Implementation
*   **Database Schema**: A relational table `profiles` in Supabase:
    *   `id` (UUID, primary key linking to `auth.users`), `nickname` (text), `avatar_url` (text representing optimized base64 data URI), `mfa_secret` (text), `mfa_enabled` (boolean).
*   **Server pre-fetching**: [layout.tsx](file:///c:/Users/cdrja/Desktop/chatbot-supabase/frontend/app/chat/layout.tsx) executes a database read using the service role client (`createAdminClient()`), passing initial states (`nickname`, `avatar_url`) to the child client wrapper. This prevents client-side rendering flicker caused by NextAuth's asynchronous session loading hooks.
*   **API Routes**: [profile/route.ts](file:///c:/Users/cdrja/Desktop/chatbot-supabase/frontend/app/api/user/profile/route.ts) handles profile reads (GET) and updates (POST) securely.

### 🔄 What Changed & Why?
*   **Initial State:** General profile values (first/last name) were loaded dynamically from Keycloak OIDC claims. Usernames and pictures were read-only, and loading them on the client caused a 200ms flicker where initials placeholders loaded first.
*   **Current State:** Fully customizable profile nicknames and avatars. Server-side pre-fetching hydrates layout parameters immediately before rendering the page HTML.
*   **Rationale (Why):** Customization increases user engagement. Server-side pre-fetching using `createAdminClient` bypasses Supabase RLS limits securely, ensuring custom profile changes are active from the very first paint frame.

---

## 12. In-App Two-Factor Authentication (MFA/2FA)

### 📝 Description
Allows users to secure their accounts using standard Time-based One-Time Passwords (TOTP). The setup, QR scanning, code verification, and session unlocking occur natively inside the chatbot.

### ⚙️ Technical Implementation
*   **RFC 6238 Validator**: Built [totp.ts](file:///c:/Users/cdrja/Desktop/chatbot-supabase/frontend/lib/totp.ts) to verify 6-digit verification codes against Base32 secrets. Includes look-ahead/look-behind windows (drift tolerance) to handle network delay or phone clock desynchronizations.
*   **QR Generator**: Swapped deprecated charts API for the modern **GoQR API** (`api.qrserver.com`) to render TOTP URIs (`otpauth://totp/Cognexa...`).
*   **Session Lock Layer**: [LayoutClient.tsx](file:///c:/Users/cdrja/Desktop/chatbot-supabase/frontend/app/chat/LayoutClient.tsx) intercepts page routing. If `mfa_enabled` is true in their database profile and `mfa_verified` is not true in the browser's `sessionStorage`, a full-screen input block card is displayed.
*   **Custom Stacked Modals**: Replaced browser confirm/alert popups in [Sidebar.tsx](file:///c:/Users/cdrja/Desktop/chatbot-supabase/frontend/components/Sidebar.tsx) with custom stacked modals for enabling, verifying, and disabling MFA.

### 🔄 What Changed & Why?
*   **Initial State:** No secondary security checks; password validation was the sole security barrier.
*   **Current State:** 6-digit TOTP verification is required on login. The setup/removal flows use elegant overlays.
*   **Rationale (Why):** Standard MFA compliance. Storing the secret in `profiles` and verifying it in-app keeps the login experience unified. Checking `sessionStorage` and clearing verification tokens on user logout or login mount ensures active, secure session closures.

---

## 13. OIDC Identity Mapping & Keycloak Theme Overrides

### 📝 Description
Customizes Keycloak's login identity provider callbacks and required actions. If a user authenticates via Google OIDC, their Google avatar is synced. If they click "Change Password" in-app, they are redirected to a customized, styled FreeMarker theme page in Keycloak.

### ⚙️ Technical Implementation
*   **Google IDP Sync**: Configured mappers in Keycloak to import Google's `picture` URL claim into the user's `picture` attribute under `FORCE` sync mode, and mapped this user attribute to the client ID tokens.
*   **Required Action Endpoint**: [change-password/route.ts](file:///c:/Users/cdrja/Desktop/chatbot-supabase/frontend/app/api/user/change-password/route.ts) utilizes Keycloak Admin API credentials to attach the `UPDATE_PASSWORD` action to the user record, logging them out to force the reset flow.
*   **FreeMarker Templates**: Created [login-update-password.ftl](file:///c:/Users/cdrja/Desktop/chatbot-supabase/keycloak/themes/cognexa/login/login-update-password.ftl) and [login-config-totp.ftl](file:///c:/Users/cdrja/Desktop/chatbot-supabase/keycloak/themes/cognexa/login/login-config-totp.ftl) styled with Tailwind to replace Keycloak's default screens.

### 🔄 What Changed & Why?
*   **Initial State:** Password resets were handled by generic, un-styled Keycloak browser pages, and user avatars defaulted to initials because Google claims were not mapped to NextAuth.
*   **Current State:** Styled update password screens matching the Cognexa theme. Google avatars are imported automatically.
*   **Rationale (Why):** Professional appearance. Consistently styled pages prevent users from thinking they have been redirected to an untrusted third-party site when updating critical credentials.

---

## 14. Next.js Standalone Build & EC2 Performance Tuning

### 📝 Description
Optimizes Docker compilation times and memory configurations to allow fast, low-overhead container builds on AWS Free Tier EC2 instances (1 vCPU, 1GB RAM).

### ⚙️ Technical Implementation
*   **Standalone Output**: Configured `output: "standalone"` in `next.config.ts`. Next.js output files trace dependency imports, packaging only runtime necessities into `.next/standalone`, discarding devDependencies.
*   **Dockerfile Optimization**: Updated `Dockerfile` Stage 2 to copy only the standalone output folder (~30MB) and static files, eliminating the need to copy the full `node_modules` folder (500MB+), which slashed image export times from 70s to 1s.
*   **Context Ignore**: Added `.dockerignore` to block the host OS's local `node_modules` and compiled `.next` caches from transferring to the Docker daemon.
*   **Typecheck Bypass**: Set `ignoreBuildErrors: true` in the compiler options specifically during container assembly since these checks are run locally before push, saving critical CPU cycles on the EC2 runner.

### 🔄 What Changed & Why?
*   **Initial State:** Local docker compiles on EC2 took over 5 minutes and occasionally locked up the CPU completely, crashing the server.
*   **Current State:** Builds compile and stage in under 2 minutes, with container copy/export steps completing in a fraction of a second.
*   **Rationale (Why):** Micro cloud instances have extremely limited RAM and CPU credits. Offloading Webpack type-checking, preventing context bloat, and utilizing Standalone dependencies avoids credit exhaustion, ensuring high server availability during upgrades.

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
