# 🧠 Synapse - Local RAG (Second Brain) System

Synapse is a **100% local, offline-first** Artificial Intelligence backend architecture that stores your personal data (notes, documents, articles) and answers your questions based solely on your own data. 

Built with modern AI Engineering principles, it uses a **Retrieval-Augmented Generation (RAG)** pipeline without sending a single byte of your data to external APIs like ChatGPT or Claude. Everything runs completely on your local machine.

## 🚀 Key Features
- **Semantic Vector Search:** Uses `pgvector` and Cosine Similarity to find the mathematical meaning behind questions rather than relying on exact keyword matches.
- **Microservices Architecture:** Heavy tasks (like embedding large documents) are offloaded to background workers using **Redis** and **BullMQ**, ensuring the main API remains lightning fast.
- **Real-Time Streaming:** Generates AI responses word-by-word via **WebSockets**, providing a ChatGPT-like typing experience in real-time.
- **Fully Containerized:** The entire system (API, Worker, Postgres, Redis) is orchestrated with a single `docker-compose up` command.
- **Local LLMs:** Powered by **Ollama**, utilizing powerful open-source models like `llama3.1` and `nomic-embed-text`.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express, TypeScript, Socket.io
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

### 3. Run the System
Navigate to the project directory and run Docker Compose:
```bash
docker-compose up -d --build
```
This single command will spin up:
- PostgreSQL (with `pgvector` enabled)
- Redis
- Synapse API Server (Port `3000`)
- Synapse Background Worker

### 4. Database Setup
Once the containers are running, push the Prisma schema to initialize the database tables:
```bash
npx prisma migrate dev --name init
```
*(You can use `npx prisma studio` to manually create your first User and copy their UUID).*

## 🎮 How to Use

### 1. Upload a Document (API)
Send a `POST` request to `http://localhost:3000/upload` with a JSON payload:
```json
{
    "userId": "YOUR-UUID-HERE",
    "title": "My First Note",
    "content": "This is a test note that the AI will remember."
}
```
*The API will return instantly. Behind the scenes, the BullMQ Worker will vectorize the text using `nomic-embed-text` and save the 768-dimensional vector array to PostgreSQL.*

### 2. Ask a Question (WebSocket Chat)
Open `http://localhost:3000` in your browser. This will load the built-in HTML interface.
Ask a question like: *"What was my first note about?"*

**The RAG Pipeline in action:**
1. The system vectorizes your question.
2. It searches Postgres using Cosine Distance (`<=>`) for the top 3 most relevant notes.
3. It passes those exact notes as "Context" to `llama3.1` with a strict prompt.
4. `llama3.1` answers the question and streams it back to your screen word-by-word via Socket.io.
