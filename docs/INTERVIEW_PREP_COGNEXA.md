# Cognexa AI - Interview Preparation Guide

## Q1: Why is it named "Enterprise Hybrid RAG Platform" instead of just a "RAG Platform"? What does "Hybrid" signify?

### Concise 30-Second Answer
> "It's named **Hybrid RAG** because it operates across three critical enterprise dimensions:
> 1. **Hybrid Inference**: Switch dynamically between **Cloud LLMs (Gemini 2.5/1.5)** for high reasoning and **Local LLMs (Ollama/Llama 3)** for offline/confidential data.
> 2. **Hybrid Ingestion**: Combines fast text parsing with **Surya Neural OCR** to process scanned PDFs, Word, Excel, and CSV files into **Qdrant Vector DB**.
> 3. **Hybrid Security**: Integrates **Keycloak OAuth2 / OpenID Connect (SSO + TOTP 2FA)** with **Supabase Row Level Security (RLS)** for multi-tenant data isolation."

---

### Core Technical Pillars Summary

| Architectural Dimension | Traditional RAG | Cognexa Enterprise Hybrid RAG |
| :--- | :--- | :--- |
| **Inference Engine** | Vendor lock-in (Cloud API only) | **Hybrid Choice**: Cloud Gemini API + On-Premise Ollama Docker container. |
| **Document Processing** | Plain text parsing only | **Hybrid Extraction**: PyMuPDF + Surya Neural OCR for scanned PDFs, XLSX, CSV, DOCX. |
| **Vector Isolation** | Shared vector space | **Isolated Qdrant Vectors**: Filtered by `user_id`, `agent_id`, and `chat_id`. |
| **Security & Auth** | Basic session cookies | **Enterprise Auth**: Keycloak SSO, 2FA/MFA, NextAuth JWT, Supabase RLS. |

---

### Key Technical Talking Points for Interviewers

- **Data Privacy & Governance**: Sensitive files can be processed locally via Ollama without leaving the enterprise network; non-sensitive tasks route to Gemini for deep reasoning.
- **Scanned PDF Handling**: Fallback to Surya OCR ensures complex tables and image-based PDFs don't result in empty text extraction.
- **Multi-Tab & Session Sync**: Built custom `BroadcastChannel` and `localStorage` session synchronization to prevent stale auth tokens across multi-tab enterprise workflows.
