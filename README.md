# 🧠 Synapse - Local RAG (Second Brain) System

Synapse is a **100% local, offline-first** Artificial Intelligence backend architecture that stores your personal data (notes, documents, articles) and answers your questions based solely on your own data. 

Built with modern AI Engineering principles, it uses a **Retrieval-Augmented Generation (RAG)** pipeline without sending a single byte of your data to external APIs like ChatGPT or Claude. Everything runs completely on your local machine.

## 🚀 Key Features
- **Automatic File Sync (Watcher):** Point Synapse to your local notes folder (like an Obsidian vault). Any `.md` file you create or update is instantly detected, read, and vectorized automatically. No manual uploads needed!
- **Semantic Vector Search:** Uses `pgvector` and Cosine Similarity to find the mathematical meaning behind questions rather than relying on exact keyword matches.
- **Microservices Architecture:** Heavy tasks (like embedding large documents) are offloaded to background workers using **Redis** and **BullMQ**, ensuring the main system remains lightning fast.
- **Real-Time Streaming:** Generates AI responses word-by-word via **WebSockets**, providing a ChatGPT-like typing experience in real-time.
- **Fully Containerized:** The entire system (API, Worker, Watcher, Postgres, Redis) is orchestrated with a single `docker-compose up` command.
- **Local LLMs:** Powered by **Ollama**, utilizing powerful open-source models like `llama3.1` and `nomic-embed-text`.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express, TypeScript, Socket.io, Chokidar (File Watcher)
- **Database & ORM:** PostgreSQL, `pgvector`, Prisma ORM v7
- **Queue System:** Redis, BullMQ
- **AI & Embeddings:** Ollama
- **DevOps:** Docker, Docker Compose

## 📦 Quick Start

### 1. Prerequisites
- [Docker & Docker Compose](https://www.docker.com/)
- [Ollama](https://ollama.com/) installed on your host machine.

### 2. Pull Required AI Models
Before starting the system, ensure Ollama has the required models downloaded:
```bash
ollama pull llama3.1
ollama pull nomic-embed-text
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory and add the path to the folder where you keep your markdown notes:
```env
LOCAL_NOTES_DIR="C:\Users\YourName\Notes"
WATCH_DIR=/app/notes
DATABASE_URL=postgresql://postgres:123@db:5432/synapsedb?schema=public
REDIS_HOST=redis
OLLAMA_HOST=http://host.docker.internal:11434
```

### 4. Run the System
Navigate to the project directory and run Docker Compose:
```bash
docker-compose up -d --build
```
This single command will spin up all 5 containers (DB, Redis, API, Worker, Watcher).

### 5. Database Setup (First Time Only)
Once the containers are running, push the Prisma schema to initialize the database tables:
```bash
npx prisma migrate dev --name init
```

## 🎮 How to Use

### 1. Just Take Notes!
You don't need to manually upload anything. Just create or edit a `.md` file in your `LOCAL_NOTES_DIR` (e.g., using Obsidian or Notepad).
*Behind the scenes, the Synapse Watcher will detect the change, read the file, and send it to the BullMQ Worker to be vectorized using `nomic-embed-text` and saved to PostgreSQL.*

### 2. Ask a Question (WebSocket Chat)
Open `http://localhost:3000` in your browser. This will load the built-in HTML interface.
Ask a question like: *"What was my last note about?"*

**The RAG Pipeline in action:**
1. The system vectorizes your question.
2. It searches Postgres using Cosine Distance (`<=>`) for the top 3 most relevant notes.
3. It passes those exact notes as "Context" to `llama3.1` with a strict prompt.
4. `llama3.1` answers the question and streams it back to your screen word-by-word via Socket.io.
