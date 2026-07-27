# 🛡️ SentinelEDR: AI-Powered Windows Endpoint Detection & Response System

> **Architectural Blueprint & Portfolio Design Document**
> 
> This document details the technical architecture, systems design, feature breakdown, implementation roadmap, resume bullet points, and technical interview defense strategies for **SentinelEDR** — a hybrid C++20 and Local LLM Windows security engine.

---

## 🗺️ 1. Complete Project Overview

SentinelEDR is a **hybrid-architecture Windows Endpoint Detection & Response (EDR) and behavioral threat analysis engine**. It bridges low-level native systems programming with on-device artificial intelligence.

```
+-----------------------------------------------------------------------------------+
|                           NATIVE C++ SYSTEM MONITOR                               |
|                                                                                   |
|  +------------------+  +-------------------+  +------------------+  +----------+  |
|  | Process/Threads  |  | File (IOCP/FS)    |  | Network (IPHelper|  | Memory/  |  |
|  | (Toolhelp/ETW)   |  | ReadDirChangesW)  |  | GetExtTcpTable)  |  | PE Header|  |
|  +--------+---------+  +---------+---------+  +--------+---------+  +----+-----+  |
|           |                      |                     |                 |        |
|           +----------------------+----------+----------+-----------------+        |
|                                             |                                     |
|                                             v                                     |
|                        +--------------------+--------------------+                |
|                        |    DETERMINISTIC HEURISTIC ENGINE       |                |
|                        | (Parent-Child, RWX Scan, Rules Matrix)  |                |
|                        +--------------------+--------------------+                |
+---------------------------------------------|-------------------------------------+
                                              | (Structured JSON Telemetry)
                                              v
+-----------------------------------------------------------------------------------+
|                         LOCAL AI THREAT SYNTHESIS LAYER                           |
|                                                                                   |
|                        +-----------------------------------------+                |
|                        |       Ollama / Llama.cpp (Local)        |                |
|                        | (Llama-3.2 3B / Qwen-2.5 1.5B GGUF)      |                |
|                        +--------------------+--------------------+                |
|                                             |                                     |
|                                             v                                     |
|                        +--------------------+--------------------+                |
|                        |  Human-Readable Incident Reports &      |                |
|                        |  Natural Language Security Assistant    |                |
|                        +-----------------------------------------+                |
+-----------------------------------------------------------------------------------+
```

### Architectural Separation
1. **System Telemetry & Detection Engine (C++20)**: Executes entirely in native C++ using Win32 and Native APIs. It operates with microsecond latency, zero cloud dependency, and minimal CPU/RAM overhead. It handles process enumeration, network socket inspection, file monitoring, memory scanning, and rule-based threat evaluation.
2. **Local AI Analysis Engine (Python / Local LLM)**: Consumes structured JSON events emitted by the C++ engine over local IPC or REST endpoints. It operates asynchronously, translating binary signatures, parent-child process chains, and memory anomalies into human-readable risk assessments and incident reports.

---

## 🎯 2. Problem Statement

Enterprise security teams and system administrators face two distinct challenges:
1. **Raw Telemetry Fatigue**: Standard Windows utilities (Sysinternals Process Explorer, Event Viewer) output millions of raw events, Hex memory addresses, PID numbers, and numeric Event IDs. Interpreting these logs requires specialized malware analysis expertise.
2. **Heavy Cloud Dependency & Privacy Risks**: Traditional endpoint tools often stream sensitive system logs, internal file paths, and network IP addresses to third-party cloud analytics platforms, introducing bandwidth bottlenecks and compliance/privacy vulnerabilities.

**The Solution**: An endpoint detection tool that processes security events locally at the native OS layer, evaluates threat heuristics deterministically, and leverages an offline local LLM to deliver actionable security insights without sending a single byte outside the endpoint.

---

## ⚡ 3. Why This Architecture Outperforms Traditional Tools

| Architectural Attribute | Traditional System Monitors (e.g., Process Explorer) | Cloud-Based AI Security Tools | **SentinelEDR (Hybrid C++ / Local LLM)** |
| :--- | :--- | :--- | :--- |
| **System Overhead** | Low | High (Constant Network Streaming) | **Microsecond C++ engine; zero LLM impact on OS monitoring** |
| **Threat Intelligence** | Static lists (shows PIDs & IPs) | Cloud ML models | **Local heuristic rules + On-device offline LLM synthesis** |
| **Data Privacy** | Local, but raw | Low (Data sent to third-party APIs) | **100% Offline & Private (Local GGUF models)** |
| **Usability** | Requires expert interpretation | Generates massive alerts | **Translates complex OS telemetry into plain English reports** |
| **System Reliability** | High | Fails if internet drops | **100% functional without AI (AI layer is purely additive)** |

---

## 🏷️ 4. Professional Project Titles
* **SentinelEDR**: Modern C++ AI-Augmented Endpoint Detection & Response System *(Recommended)*
* **Aegis-EDR**: Autonomous Windows System Telemetry & Behavioral Threat Analysis Engine
* **CoreGuard EDR**: Low-Overhead Windows System Monitor & Heuristic Threat Analyzer

---

## 🧩 5. Comprehensive Module Breakdown

### 🔹 Module 1: Process & Thread Observer (`ProcessMonitor`)
* **Functions**: Enumerates running processes and tracks system process trees.
* **Win32 APIs**: `CreateToolhelp32Snapshot`, `Process32FirstW`, `Process32NextW`, `OpenProcess`, `QueryFullProcessImageNameW`.
* **Key Tasks**:
  * Constructs a parent-child PID mapping tree.
  * Tracks newly spawned processes and terminated processes.
  * Extracts command-line arguments and process user SID (`OpenProcessToken`, `GetTokenInformation`).

### 🔹 Module 2: File System Watcher (`FileMonitor`)
* **Functions**: Watches critical operating system directories (`C:\Windows\System32`, `AppData\Roaming`, `Temp`) for rapid file creation, deletion, or extension modifications (e.g., ransomware indicators).
* **Win32 APIs**: `CreateFileW`, `ReadDirectoryChangesW`, I/O Completion Ports (IOCP).
* **Key Tasks**: Asynchronously captures file creation, modification, and rename events without polling.

### 🔹 Module 3: Network Socket Inspector (`NetworkMonitor`)
* **Functions**: Maps active network TCP/UDP sockets directly to the owning Process ID (PID).
* **Win32 APIs**: `GetExtendedTcpTable`, `GetExtendedUdpTable` from `iphlpapi.lib`.
* **Key Tasks**: Correlates outbound connections (remote IP, port) with specific executable paths to flag anomalous network behavior.

### 🔹 Module 4: Memory Protection & Injection Scanner (`MemoryScanner`)
* **Functions**: Scans process virtual memory spaces for suspicious memory flags commonly used in Process Injection and Shellcode Execution.
* **Win32 APIs**: `VirtualQueryEx`, `ReadProcessMemory`.
* **Key Tasks**: Flags process memory regions marked with `PAGE_EXECUTE_READWRITE` (RWX), which indicate potential shellcode buffers.

### 🔹 Module 5: Portable Executable (PE) Analyzer (`PEParser`)
* **Functions**: Parses PE binary headers to extract structural metadata from executables.
* **Win32 Structs**: `IMAGE_DOS_HEADER`, `IMAGE_NT_HEADERS`, `IMAGE_SECTION_HEADER`, `IMAGE_IMPORT_DESCRIPTOR` from `<winnt.h>`.
* **Key Tasks**: Parses import tables to detect suspicious API imports (e.g., `VirtualAllocEx`, `WriteProcessMemory`, `CreateRemoteThread`) and checks section entropy.

### 🔹 Module 6: Heuristic Threat Engine (`DetectionEngine`)
* **Functions**: Applies deterministic rules to incoming telemetry from Modules 1–5.
* **Rule Logic**:
  * **Rule A (Suspicious Spawning)**: `WINWORD.EXE` or `EXCEL.EXE` spawning `powershell.exe` or `cmd.exe`.
  * **Rule B (Process Masquerading)**: Process named `svchost.exe` running outside of `C:\Windows\System32\`.
  * **Rule C (Memory Injection Risk)**: Process allocating RWX memory while maintaining active outbound network connections.
* **Output**: Produces structured `ThreatAlert` structs serialized into JSON (`nlohmann/json`).

### 🔹 Module 7: Local AI Synthesis Layer (`AIAnalyzer`)
* **Functions**: Receives JSON telemetry payloads, feeds them to a local LLM runner (Ollama / Llama.cpp GGUF), and outputs structured security analyses.
* **Key Tasks**: Evaluates risk levels, lists possible explanations, and suggests remediation steps in human-readable markdown format.

---

## 📈 6. Feature Scoping & Phasing

```
                 +-------------------------------------------------------+
                 |                       VERSION 1                       |
                 |              (Core MVP - 2 to 4 Weeks)                |
                 |  • Toolhelp Process & Parent-Child Tree Tracking       |
                 |  • ReadDirectoryChangesW File System Monitor          |
                 |  • GetExtendedTcpTable Network Socket Inspector       |
                 |  • Modern C++ Rule Engine (Parent-Child Anomalies)   |
                 |  • JSON Exporter & Ollama REST AI Integration         |
                 +---------------------------+---------------------------+
                                             |
                                             v
                 +-------------------------------------------------------+
                 |                       VERSION 2                       |
                 |             (Advanced Features - 4 to 6 Weeks)        |
                 |  • VirtualQueryEx RWX Memory Injection Scanner        |
                 |  • PE Header Parser (Imports & Section Entropy)       |
                 |  • Registry Run Key Persistence Watcher               |
                 |  • Multi-threaded Producer-Consumer Telemetry Queue    |
                 +---------------------------+---------------------------+
                                             |
                                             v
                 +-------------------------------------------------------+
                 |                    FUTURE EXPANSION                   |
                 |  • Event Tracing for Windows (ETW) Subscriptions      |
                 |  • KMDF Kernel-Mode Minifilter Driver                 |
                 |  • YARA Engine C++ Integration                        |
                 +-------------------------------------------------------+
```

---

## 💻 7. Resume-Ready Tech Stack

* **Core Systems Language**: Modern C++ (C++20), Win32 API, C.
* **Windows Internals & Security**: Toolhelp API, IP Helper API (`iphlpapi`), Windows File Systems (IOCP), PE Header Analysis (`winnt.h`), Process Memory Management.
* **Architecture & Concurrency**: Multi-threading (`std::thread`, `std::mutex`, `std::condition_variable`, `std::atomic`), RAII, Modern CMake, MSVC (Visual Studio 2022).
* **Data Pipelines & Integration**: JSON Serialization (`nlohmann/json`), REST API / HTTP Client (`httplib`), IPC.
* **AI & Security Intelligence**: Ollama, Local GGUF Models (Llama-3.2 / Qwen-2.5), Heuristic Threat Rule Engine.

---

## 📄 8. ATS-Optimized Resume Bullet Points

### **Project Title: SentinelEDR – AI-Augmented Windows Endpoint Detection & Response System**
*Tech Stack: Modern C++ (C++20), Win32 APIs, Windows Internals, Multi-threading, Network & Memory Security, JSON, Ollama (Local LLM), CMake*

* **Engineered a Low-Overhead Windows EDR Engine**: Developed a native C++20 endpoint monitoring system utilizing Win32 APIs (`Toolhelp32`, `ReadDirectoryChangesW`, `iphlpapi`) to track process execution trees, file system operations, and active TCP/UDP sockets with microsecond latency.
* **Architected Deterministic Heuristic Detection**: Designed a rule engine to detect anomalous process behavior, identifying high-risk execution chains (e.g., MS Office spawning administrative shells) and process masquerading with zero reliance on cloud services.
* **Implemented Asynchronous Memory & PE Inspection**: Built a PE binary parser (`winnt.h`) and process memory scanner (`VirtualQueryEx`) to flag suspicious import tables and `PAGE_EXECUTE_READWRITE` (RWX) memory allocations indicative of shellcode injection.
* **Integrated Offline AI Threat Synthesis**: Designed an event-driven telemetry pipeline (`nlohmann/json`) interfacing with an offline local LLM (Ollama GGUF) via REST endpoints, translating raw OS alerts into human-readable threat assessments and risk ratings.
* **Optimized High-Throughput Concurrency**: Built a lock-free/thread-safe producer-consumer telemetry queue using C++ `std::mutex` and `std::condition_variable`, maintaining continuous OS monitoring under high I/O load with <2% CPU utilization.

---

## 🚀 9. Realistic Implementation Roadmap

### **Phase 1: Win32 Core Monitoring Engine (Week 1–2)**
1. Initialize C++ CMake project in Visual Studio 2022.
2. Implement `ProcessMonitor` using `CreateToolhelp32Snapshot` to construct parent-child process trees.
3. Implement `NetworkMonitor` using `GetExtendedTcpTable` to link open ports/remote IPs to running PIDs.
4. Implement `FileMonitor` using `ReadDirectoryChangesW` for directory watching.

### **Phase 2: Detection Engine & PE Analysis (Week 3)**
1. Build `PEParser` to read DOS/NT headers and extract imported DLL functions.
2. Implement `MemoryScanner` using `VirtualQueryEx` to flag executable memory regions.
3. Create `DetectionEngine` to evaluate rule matrices and output `nlohmann::json` telemetry events.

### **Phase 3: Local AI Integration & UI/CLI (Week 4)**
1. Deploy Ollama locally with `llama3.2:3b` or `qwen2.5-coder:1.5b`.
2. Write a lightweight HTTP wrapper in C++ (or Python proxy) to pass JSON telemetry to Ollama's `/api/generate` endpoint.
3. Verify end-to-end telemetry flow: System Event ➔ C++ Heuristic Evaluation ➔ JSON Serialization ➔ Local LLM Incident Report Generation.

---

## 🛡️ 10. Technical Interview Defense Guide

### Key Interview Talking Points
* **Why C++ for Telemetry?**:
  > *"User-mode system monitoring requires predictable latency and minimal CPU/memory footprints. C++ provides direct access to Win32 APIs, native data structures, and deterministic memory management without garbage collection overhead."*
* **Why Decouple AI from the Engine?**:
  > *"LLMs are non-deterministic and can hallucinate. Security monitoring must be 100% deterministic and real-time. The C++ engine handles all security checks, while the LLM acts purely as a presentation and contextual synthesis layer."*

### Expected Interview Questions & Model Answers

#### **Q1: How do you track Process Creation in Win32 without polling?**
* **Answer**: *"In Version 1, I use `Toolhelp32` snapshot diffing for user-mode simplicity. In production/V2, the ideal approach is subscribing to Event Tracing for Windows (ETW) via `Microsoft-Windows-Kernel-Process` providers, or registering a process creation callback (`PsSetCreateProcessNotifyRoutineEx`) in a kernel-mode driver."*

#### **Q2: How does `ReadDirectoryChangesW` work under the hood?**
* **Answer**: *"It posts asynchronous system requests to the Windows I/O manager. When paired with I/O Completion Ports (IOCP) or an event handle, the OS kernel notifies our application thread buffer whenever a directory action occurs, avoiding costly disk polling loops."*

#### **Q3: What is Process Hollowing, and how can your engine detect it?**
* **Answer**: *"Process Hollowing occurs when an attacker spawns a legitimate process (like `svchost.exe`) in a suspended state, unmaps its memory using `NtUnmapViewOfSection`, allocates replacement memory with `VirtualAllocEx`, and writes malicious code. My engine checks if the memory base address of an active process matches its PE headers on disk, and flags any memory pages marked with `PAGE_EXECUTE_READWRITE` (RWX)."*

#### **Q4: How do you handle thread safety in your telemetry pipeline?**
* **Answer**: *"I implemented a thread-safe Producer-Consumer queue. Background collector threads push telemetry events into a shared queue protected by a `std::mutex` and `std::condition_variable`. Worker threads consume events, format them into JSON payloads, and forward them to the AI analysis layer without blocking main OS monitoring loops."*
