# AI Chatbot with Qdrant, Ollama, & Supabase

A containerized Next.js and FastAPI application featuring RAG document ingestion, local vector database indexing via Qdrant, and flexible LLM providers (Google Gemini API & local Ollama).

## Architecture

```
                       +-----------------------------+
                       |      Next.js Frontend       |
                       |    (ai-chatbot-frontend)    |
                       +--------------+--------------+
                                      | (HTTP /api)
                                      v
                       +-----------------------------+
                       |       FastAPI Backend       |
                       |    (ai-chatbot-backend)     |
                       +-------+-------------+-------+
                               |             |
                    (HTTP)     v             v     (HTTP)
           +----------------------+       +----------------------+
           |     Ollama LLM       |       |    Qdrant Vector DB  |
           |  (ai-chatbot-ollama) |       |  (ai-chatbot-qdrant) |
           +----------------------+       +----------------------+
                               \             /
                                v           v
                            +-------------------+
                            |     Supabase      |
                            | (Auth & Storage)  |
                            +-------------------+
```

### Containers Description

1. **`ai-chatbot-frontend`** (`ghcr.io/atharvachaudhari9/ai-chatbot-supabase/frontend:latest`): Next.js app serving client-side UI, user authentication, and chat history. Relies on the backend container for embedding searches and document ingestion.
2. **`ai-chatbot-backend`** (`ghcr.io/atharvachaudhari9/ai-chatbot-supabase/backend:latest`): FastAPI service handling document text extraction (PyMuPDF & Surya OCR fallback), text chunking, dynamic model size checks, local embedding queries, and Qdrant interactions.
3. **`ai-chatbot-qdrant`** (`qdrant/qdrant:latest`): Vector database storing chunk embeddings and payload metadata, handling similarity search and RLS metadata filters.
4. **`ai-chatbot-ollama`** (`ollama/ollama:latest`): Runs local LLMs and generates embedding vectors on CPU (or optional GPU).

---

## Environment Setup

Before running the application, set up your configuration files:

1. **Root Configuration**:
   Create a `.env` file at the project root based on `.env.example`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   GEMINI_API_KEY=your-optional-gemini-key
   ```

2. **Backend Configuration**:
   Create a `backend/.env` file based on `backend/.env.example`:
   ```env
   SUPABASE_URL=https://your-supabase-url.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

   OLLAMA_BASE_URL=http://ai-chatbot-ollama:11434
   OLLAMA_MODEL=nomic-embed-text

   QDRANT_HOST=ai-chatbot-qdrant
   QDRANT_PORT=6333
   QDRANT_COLLECTION=documents
   ```

---

## Getting Started

### 1. Build and Start the Stack
Initialize and build all services:
```bash
docker compose up --build
```
To start in the background:
```bash
docker compose up -d
```

### 2. Pull Ollama Models
Once the containers are up, pull the required embedding model and chat model. Run:
```bash
# Pull the default embedding model
docker exec -it ai-chatbot-ollama ollama pull nomic-embed-text

# Pull the chat model (e.g. qwen2.5-coder:7b or similar)
docker exec -it ai-chatbot-ollama ollama pull qwen2.5-coder:7b
```
All pulled models are saved in the persistent `ollama_models` volume and will persist across container restarts.

---

## Docker Commands Cheat Sheet

*   **Build images**: `docker compose build`
*   **Start services**: `docker compose up`
*   **Stop services**: `docker compose down`
*   **Restart/Rebuild**: `docker compose up --build`
*   **Check logs**: `docker compose logs -f`

---

## CI/CD Pipeline

The project features a fully automated continuous integration and deployment workflow powered by **GitHub Actions** and **GitHub Container Registry (GHCR)**:

*   **Workflow Config**: Located in [.github/workflows/deploy.yml](file:///c:/Users/cdrja/Desktop/chatbot-supabase/.github/workflows/deploy.yml).
*   **Triggers**: Automatic deployment on push to `main` branch.
*   **Process**:
    1.  Remote GitHub Actions runners compile the `frontend` and `backend` Docker containers.
    2.  Pushes compiled images under the `:latest` tag to GHCR.
    3.  Establishes an SSH connection to your AWS EC2 production instance.
    4.  Pulls the new package layers and triggers a container restart via `docker-compose pull && docker-compose up -d`.
    5.  Prunes stale Docker images on the EC2 host automatically to conserve Free Tier disk space.

*Refer to the [walkthrough.md](file:///C:/Users/cdrja/.gemini/antigravity-ide/brain/d71337b1-dcd5-4f2f-b0dd-1eabe627a97c/walkthrough.md) artifact for the environment secrets setup instructions required to activate the pipeline.*

---

## NVIDIA GPU Acceleration (Optional)

To enable GPU acceleration for Ollama, you must have the NVIDIA Container Toolkit installed:

### Setup
1. Ensure your host system has the latest **NVIDIA Drivers** installed.
2. Install the **NVIDIA Container Toolkit** following the [official installation guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).
3. Add the NVIDIA runtime definition to the `ollama` service block in `docker-compose.yml`:
   ```yaml
     ollama:
       ...
       deploy:
         resources:
           reservations:
             devices:
               - driver: nvidia
                 count: all
                 capabilities: [gpu]
   ```

If no GPU reservations are defined or if you lack NVIDIA hardware, Ollama will gracefully run on the **CPU** (default behavior).

---

## Troubleshooting

*   **FastAPI Backend Connection Timeout**: If the backend fails to start because it cannot connect to Qdrant or Ollama, verify that the containers are healthy. You can check individual container statuses with `docker compose ps`.
*   **Next.js Authentication Error**: Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are defined in the root `.env` **before** running `docker compose up --build` as they are compiled at build time.
*   **Port conflicts**: If port `3000`, `8000`, `6333`, or `11434` is already in use on your host system, change the port mappings in `docker-compose.yml`.