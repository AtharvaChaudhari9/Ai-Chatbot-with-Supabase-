# AI Chatbot Development Cycle & System Design Portfolio

> [!NOTE]
> This is **Part 1** of a two-part developer portfolio designed for technical interview preparation:
> *   **Part 1 (This Document)**: Focuses on the high-level **system design, architectural evolution stages, microservice decoupling, vector store selection, Docker orchestration, and mock interview Q&As**.
> *   **Part 2 ([FEATURES_AND_FUNCTIONALITY.md](file:///c:/Users/cdrja/Desktop/chatbot-supabase/FEATURES_AND_FUNCTIONALITY.md))**: Focuses on the **detailed feature specs, low-level modules, database/Qdrant schemas, what changed at a functional level, and why those changes were made**.
> 
> *As you implement new features moving forward, use the extension guidelines at the bottom of both files to keep them updated.*

---

## 🗺️ Architectural Evolution at a Glance

The project evolved from a monolithic cloud-reliant hobby project into a decoupled, fully containerized, hybrid cloud/local **Retrieval-Augmented Generation (RAG)** platform.

| Stage | Focus Area | Technology Added | Primary Bottleneck Solved | Key Engineering Decision |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Core MVP** | Next.js, Gemini API, Supabase | Initial product validation | Directly persistence-focused chatbot. Relational DB stores messages. |
| **2** | **Security & Auth** | Google OAuth, Supabase RLS | No user isolation | Relational row-level security (RLS) restricts access to owner `user_id`. |
| **3** | **Local LLM Integration** | Ollama, Local Models | Token costs, cloud rate limits | Enabled hybrid switching between Gemini (cloud) and local models. |
| **4** | **Initial RAG & OCR** | PDF parsing, Supabase `pgvector` | LLM lack of context / hallucinations | Vectorized document chunks stored alongside chat logs. |
| **5** | **Decoupled Backend** | FastAPI (Python), PyMuPDF, Surya | Node.js single-thread CPU-bottlenecks | Migrated document parsing/OCR processing to a dedicated Python microservice. |
| **6** | **Vector DB Migration** | Qdrant (HNSW index) | DB index bloat, search latency | Moved vector embeddings out of relational database to a specialized vector database. |
| **7** | **Containerization** | Docker, Docker Compose, CUDA | "Works on my machine" issues, GPU setup | Full orchestration with isolated bridge network, service discovery, and GPU passthrough. |
| **8** | **AWS Cloud Deployment** | AWS EC2, Nginx, Certbot (SSL), DuckDNS, Swap | Localhost limits, insecure HTTP, low RAM | Deployed to AWS EC2 using a reverse proxy with tuned buffers, swap file optimization, and cloud LLM fallback. |
| **9** | **Automated CI/CD** | GitHub Actions, GHCR | Compilation overhead on EC2, manual deploys | Offloaded heavy Docker image compilation to remote runners, deploying pre-built packages to save host resources. |

---

## 🛠️ Stage-by-Stage Architectural Breakdown

### Stage 1: The Core Chatbot MVP
*   **Architecture**: A Next.js frontend making direct HTTP requests to the Google Gemini API. Chat history and session metadata are stored in Supabase (PostgreSQL tables `chats` and `messages`).
*   **Why Supabase?** It provided an instant PostgreSQL backend, connection pooling, and client SDKs, eliminating the need to write a boilerplate Express/NestJS backend in the early validation phase.
*   **Engineering Trade-offs**: 
    *   *Pros*: Fast time-to-market; minimal infrastructure setup.
    *   *Cons*: Next.js server routes or client actions are heavily coupled. Gemini API keys were either shipped to the client (insecure) or proxied through Next.js server actions, introducing API invocation latency.

### Stage 2: Security & Multi-tenancy (Google OAuth)
*   **Architecture**: Integrated Supabase Auth with Google OAuth (Google Login). Table structures in Supabase were secured using **Row Level Security (RLS)**.
*   **Why OAuth & RLS?** Security must be enforced at the database level, not the application level. If an application bug exists, database-level RLS prevents `User A` from reading `User B`'s chat histories.
*   **Key Concept to Explain in Interviews**:
    > "I configured PostgreSQL RLS policies where `auth.uid() = user_id`. This ensures that even if a developer forgets a `WHERE` clause in a frontend query, the database itself filters out unauthorized records at the engine level."

### Stage 3: Local LLM Integration (Ollama)
*   **Architecture**: Next.js Server Actions were expanded to support Ollama. Users can dynamically switch their model provider.
*   **Engineering Rationale**:
    1.  **Cost Mitigation**: Avoided mounting API fees during development and high-frequency testing.
    2.  **Privacy & Offline Capable**: Allows processing sensitive chats entirely on the developer's local machine.
    3.  **Resilience**: Protects the app from cloud outages or Gemini rate limits.

### Stage 4: Retrieval-Augmented Generation (RAG) & OCR Ingestion
*   **Architecture**: Users upload files (PDFs, DOCX, Images). Document text was extracted, split into semantic chunks, converted into vector embeddings, and indexed in Supabase using the `pgvector` extension.
*   **Why RAG?** LLMs are static. By feeding the LLM the top $k$ most relevant document chunks based on a vector similarity search, the LLM can answer questions using proprietary, up-to-date user data without needing model fine-tuning.
*   **The Wall**: We hit a performance wall. Document parsing (specifically scanned PDFs and images) required heavy optical character recognition (OCR). Running OCR models and embedding generation in a Node.js runtime (Next.js) blocked the single-threaded event loop, leading to API timeouts and freezing the entire UI.

### Stage 5: Modular Python Backend (FastAPI Integration)
*   **Architecture**: Extracted all ingestion, parsing, chunking, OCR, and embedding pipelines into a separate Python backend using **FastAPI**. Next.js remained as a lightweight client-facing server and UI wrapper.
*   **Engineering Rationale**:
    1.  **Ecosystem Compatibility**: AI/ML libraries (PyMuPDF, Surya OCR, PyTorch, HuggingFace Transformers) are native to Python.
    2.  **Performance (Multi-threading)**: FastAPI is built on ASGI (`uvicorn`), allowing asynchronous execution. Heavy compute tasks (like OCR) are offloaded to background threads or subprocess pools without blocking Next.js UI rendering.
    3.  **Separation of Concerns**: Scaling UI traffic is cheap (horizontal container replication). Scaling OCR compute is expensive (GPU/High-CPU nodes). Decoupling them allows independent auto-scaling.

### Stage 6: Database Optimization (pgvector to Qdrant)
*   **Architecture**: Replaced Supabase `pgvector` with **Qdrant**, a dedicated vector search engine written in Rust. Supabase remains strictly for relational data (chats, auth, message logs), while Qdrant stores document text chunks and vector embeddings.
*   **Why Qdrant over PostgreSQL (pgvector)?**
    1.  **Indexing Algorithms**: Relational databases struggle with multi-dimensional vector indices under scale. Qdrant uses highly optimized **HNSW (Hierarchical Navigable Small World)** graphs, which partition vector spaces for sub-millisecond, approximate nearest-neighbor (ANN) queries.
    2.  **Advanced Metadata Filtering**: RAG needs to filter vectors based on `user_id` and `document_id`. Doing this in `pgvector` often triggers slow sequential scans. Qdrant performs payload filtering *during* the graph traversal, keeping retrieval speeds constant.
    3.  **Resource Contention**: Heavy vector calculations and index rebuilds consume massive CPU and RAM. Offloading these from our transaction database (Supabase) prevents database locks and ensures transactional chat data queries remain fast.

### Stage 7: Full Containerization (Docker Compose & GPU Integration)
*   **Architecture**: Orchestrated Next.js, FastAPI, Qdrant, and Ollama in a multi-container Docker bridge network. Optimized Python builds for PyTorch, and enabled local NVIDIA GPU passthrough for Ollama.
*   **Engineering Rationale**:
    1.  **Reproducibility**: Guarantees identical execution between dev and prod. No manual setup of Python virtual environments, system OCR libraries, or Node packages.
    2.  **Service Discovery**: Hardcoded IP addresses and local ports were replaced with internal Docker DNS hostnames (`http://ai-chatbot-backend:8000`, `http://ai-chatbot-qdrant:6333`).
    3.  **GPU Passthrough**: Used the NVIDIA Container Toolkit to map the host GPU (WSL2/Linux CUDA driver) into the Ollama container, speeding up inference by up to 10x.

### Stage 8: AWS Cloud Deployment & Performance Tuning
*   **Architecture**: Deployed the containerized application on a free-tier AWS EC2 instance. Configured **Nginx** as a reverse proxy on Port 80/443 to forward traffic to the Next.js container (Port 3000) and secure it using a free SSL certificate from **Certbot (Let's Encrypt)** mapped to a **DuckDNS** subdomain.
*   **Engineering Rationale**:
    1.  **Security**: Kept database and backend API ports (6333, 8000, 11434) isolated inside the private Docker bridge network, exposing only Nginx on Port 80/443.
    2.  **Resource Constraints (1GB RAM)**: Configured 4GB of swap memory to prevent the small EC2 instance from crashing during webpack compile and pip dependencies installation.
    3.  **Cloud LLM Fallback**: Configured Google Gemini API as the primary chatbot interface in production, offloading LLM inference from the EC2's 1 vCPU, which prevents system lockups.

### Stage 9: Automated CI/CD Pipeline (GitHub Actions & GHCR)
*   **Architecture**: Implemented remote continuous integration and deployment. Upon code push, **GitHub Actions** runs linting/checks, builds Docker images on remote runners, and publishes them to **GitHub Container Registry (GHCR)**. The workflow then SSHs into the EC2 instance to pull pre-compiled images and run them using Docker Compose.
*   **Engineering Rationale**:
    1.  **Free Tier Memory Conservation**: Running live `docker-compose build` commands on a `t2.micro` (1GB RAM) instance locks up the CPU, runs heavy disk swap, and crashes running application services. Offloading compilation to GitHub's free runners saves host RAM/CPU.
    2.  **Rapid, Low-Overhead Deployments**: Pulling pre-compiled layers from GHCR takes seconds and avoids long compilation delays, providing near-zero downtime deployment.
    3.  **Enterprise Best Practices**: If a paid high-compute EC2 instance (e.g. `t3.medium` or larger with 4GB+ RAM) were used, we could have chosen a GitOps pull-based agent (such as **Watchtower** or **ArgoCD**) or self-hosted runners. However, remote building to a registry is always preferred over compiling locally on production instances to ensure clean isolation, reproducibility, and minimal security footprint.

---

## 📐 System Architecture Diagram

```
                 +-----------------------------------------+
                 |              USER BROWSER               |
                 +--------------------+--------------------+
                                      | (HTTPS)
                                      v
                 +-----------------------------------------+
                 |            NEXT.JS FRONTEND             |
                 |      (Ports: 3000 -> 3000 Host)         |
                 +----------+--------------+---------------+
                            |              |
           (Auth & Storage) |              | (Internal API Call)
                            v              v
     +-----------------------+    +-----------------------------------------+
     |   SUPABASE CLOUD      |    |             FASTAPI BACKEND             |
     | (Relational/Auth/Blob)|    |       (Ports: 8000 -> 8000 Host)        |
     +-----------------------+    +----------+--------------------+---------+
                                             |                    |
                           (Vector Search)   v                    v   (LLM Chat & Embeddings)
                                  +--------------------+  +--------------------+
                                  |    QDRANT DB       |  |     OLLAMA LLM     |
                                  |  (Rust Vector DB)  |  |   (CUDA GPU Accel) |
                                  |  (Ports: 6333)     |  |   (Ports: 11434)   |
                                  +--------------------+  +--------------------+
```

---

## ⚡ Technical Challenges Solved (Interview "War Stories")

Every strong interview needs a "What went wrong, and how did you fix it?" story. Here are four technical battles fought and won in this project:

### 1. The PyTorch Container Size Problem (Docker Optimization)
*   **Problem**: In early Docker builds, the backend container exceeded **6GB** because pip downloaded the default CUDA-enabled PyTorch wheels, even though the backend only needed CPU-only PyTorch for text-processing logic (as Ollama handles the GPU workload).
*   **Resolution**: I optimized the Dockerfile. By instructing pip to download CPU-only PyTorch directly from the official PyTorch wheel repository index *before* installing other dependencies, I shaved the container size down from **6GB+ to under 1.5GB**, reducing deployment time and disk footprint significantly.
    ```dockerfile
    RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
    ```

### 2. Service Discovery and DNS Resolution in Multi-Container Apps
*   **Problem**: Next.js client-side code running in the user's browser must call the frontend backend routes (e.g. `/api/local-models`), but server-side rendering (SSR) and server actions need to speak directly to the backend container (`http://ai-chatbot-backend:8000`). If they share a single URL environment variable, one environment will fail.
*   **Resolution**: I separated internal vs external endpoint routing. Next.js server actions call `http://ai-chatbot-backend:8000` via internal Docker DNS, while client-side components query relative paths (like `/api/...`), which Next.js proxies or routes on the client context.

### 3. Vector Database API Evolution (The Qdrant Client Deprecation)
*   **Problem**: While migrating to Qdrant, we encountered an `AttributeError` stating `QdrantClient object has no attribute 'search'`. This was due to breaking changes in newer versions of the `qdrant-client` library.
*   **Resolution**: I refactored the connection wrapper in FastAPI. I migrated the codebase from the deprecated `.search()` method to the modern `.query_points()` interface, unpacking the `response.points` structure to retrieve chunks, scores, and metadata payloads.

### 4. VRAM Limitations & Model Execution Speed
*   **Problem**: Running a 7B LLM (like `qwen2.5-coder:7b`) on a laptop GPU with limited VRAM (e.g., NVIDIA RTX 3050 with 4GB VRAM) caused severe performance degradation because the model would overflow into system RAM, slowing response generation to < 1 token/sec.
*   **Resolution**: 
    1.  *Quantization*: Configured Ollama to use 4-bit quantized GGUF models.
    2.  *Model Downsizing*: Standardized the local development defaults to use `llama3.2:3b` or `qwen2.5-coder:1.5b`. These fit entirely within the 4GB VRAM boundary, resulting in a 10x improvement in tokens-per-second, while reserving the 7B model for high-compute workstations.

### 5. Nginx 502 Bad Gateway (Large Supabase Auth Cookies)
*   **Problem**: Right after a user logged in successfully in production, Nginx threw a `502 Bad Gateway`. The logs revealed: `upstream sent too big header while reading response header from upstream`. Next.js set multiple large cookies containing Supabase access tokens, which exceeded Nginx's default 4KB/8KB header buffer limits.
*   **Resolution**: I tuned Nginx's proxy buffering directives. By adding `proxy_buffer_size 128k;`, `proxy_buffers 4 256k;`, and `proxy_busy_buffers_size 256k;` inside the Nginx virtual host block, I allowed Nginx to buffer the large authorization headers safely, resolving the 502 error.

### 6. SELinux Proxy Connection Block
*   **Problem**: On the Amazon Linux 2023 EC2 instance, Nginx failed to proxy requests to Next.js on port 3000, showing a 502 error and logging `Permission denied` when connecting to `127.0.0.1:3000`.
*   **Resolution**: Verified that SELinux policies were blocking Nginx (a system service) from initiating TCP sockets. I ran `sudo setsebool -P httpd_can_network_connect 1` to persistently allow Nginx to connect to the Docker container's mapped ports.

### 7. Ollama CPU Lockup on Low-Compute Cloud Instances
*   **Problem**: Running a query using the local Ollama backend on a single-core EC2 instance caused the request to take over 5 minutes, resulting in a timeout. The Ollama logs showed prompt processing taking `122.18s` for 1024 tokens and locking up the CPU.
*   **Resolution**: Established hybrid failover best practices. In production, we utilize the Google Gemini API (cloud-based) as the default LLM driver, ensuring sub-second response times without overloading the micro-instance's CPU.

---

## 🎯 Mock Interview QA (Prep Material)

Use these questions and answers to prepare for system design and coding interviews:

### Q1: Why did you choose Qdrant over Supabase pgvector?
*   **How to answer**: "While pgvector is excellent for early-stage MVPs because it allows keeping transactional data and vectors in one database, it has limitations at scale. First, PostgreSQL was not built for vector operations. High-dimensional vector index builds (like HNSW) consume massive amounts of CPU and RAM, which degrades transactional throughput for chat history and login requests. Second, Qdrant is built in Rust, optimized specifically for fast graph-based search. It performs hybrid search and payload filtering (e.g. restricting vector search to a specific user's documents) natively during graph traversal. Offloading vectors to Qdrant decoupled our transactional engine from our compute-heavy search engine."

### Q2: What is the flow of a document query from the user's browser to the LLM response in your RAG setup?
*   **How to answer**:
    1.  **Query Submission**: The user submits a prompt via the Next.js UI (e.g., *"What is our company's refund policy?"*).
    2.  **Context Fetching**: The Next.js server actions call the FastAPI backend's `/search` endpoint.
    3.  **Embedding Generation**: The FastAPI backend sends the prompt to the Ollama embedding model (`nomic-embed-text`) to generate a query vector.
    4.  **Similarity Search**: FastAPI queries Qdrant using the query vector, filtered by the current `user_id` to ensure data isolation. Qdrant performs an HNSW search and returns the top 3-5 text chunks.
    5.  **Prompt Synthesis**: The frontend combines the original query with these retrieved text chunks inside a structured context template.
    6.  **Inference**: This context-enriched prompt is sent to Ollama (or Gemini). The LLM processes the retrieved facts and generates an answer, which is streamed back to the user.

### Q3: How do you handle document ingestion and OCR scaling?
*   **How to answer**: "Document processing is handled asynchronously. When a user uploads a document, it is stored in Supabase storage. We extract text using PyMuPDF. If the PDF is scanned (i.e. no text layer), the FastAPI backend invokes a lightweight OCR engine (Surya OCR) to extract text from the images. Because OCR is highly CPU and memory intensive, it is decoupled into the Python backend. In a production deployment, we would offload these tasks to a task queue (like Celery with Redis) and process them in background worker containers, preventing document uploads from blocking web request threads."

### Q4: How is local GPU acceleration handled inside your Docker container environment?
*   **How to answer**: "We leverage WSL2 on Windows and the NVIDIA Container Toolkit. Docker containers don't natively see host GPU hardware. The Container Toolkit maps the host's CUDA drivers into the container runtime. In our `docker-compose.yml`, we define a reservation block under the `ollama` service specifying `capabilities: [gpu]` and `driver: nvidia`. This exposes the NVIDIA hardware to Ollama, allowing it to offload tensor calculations to the GPU's CUDA cores instead of executing them sequentially on the CPU."

### Q5: How did you design CI/CD for the application under severe memory constraints, and what would change on a paid tier?
*   **How to answer**: "We built a GitHub Actions workflow that compiles Docker images remotely and pushes them to GitHub Container Registry (GHCR), using SSH to trigger a pull-and-restart on the server. Because the deployment target is an AWS Free Tier `t2.micro` (1GB RAM), running `docker-compose build` locally triggers high swapping, locks the single-core CPU, and crashes existing web sessions. Moving compilation to GitHub's infrastructure solved this, reducing host deployment overhead to near-zero. If we upgraded to a paid high-spec EC2 tier, we would still build remotely to maintain isolated packaging, but we might transition deployment triggers from push-based SSH scripts to a pull-based GitOps loop (like Portainer Webhooks or Watchtower) to avoid storing host SSH private keys inside GitHub secrets."

---

## 📈 Future Architecture Update Roadmap

When introducing architectural updates moving forward (e.g. migrating frontend to Kubernetes, adding an orchestration framework like LangGraph, or switching authentication layers), record the changes in this document using the following template:

```markdown
### Stage [Next Stage Number]: [Stage Title]
*   **Architecture**: [Describe the updated container paths, network flows, or database links.]
*   **Engineering Rationale**:
    1. [Reason 1: e.g. lower resource usage]
    2. [Reason 2: e.g. enhanced concurrency]
*   **Design Trade-offs**:
    *   *Pros*: [Benefits]
    *   *Cons*: [Drawbacks or temporary migration debt]
```
