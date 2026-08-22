import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from './generated/prisma/client/client.js';
import { document_queue } from './queue.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app: Express = express();
const httpServer = createServer(app);
const port = 3000;
app.use(express.json());
app.use(express.static('public'));

const io = new Server(httpServer, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;
    console.log(`a user connected: ${userId}`);
    socket.on('disconnect', () => {
        console.log(`a user disconnected: ${userId}`);
    });
    socket.on('ask', async (data) => {
        const question = data.question;
        try {
            const response = await
                fetch(process.env.OLLAMA_HOST + '/api/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
                    },
                    body: JSON.stringify({
                        model: 'nomic-embed-text',
                        prompt: question
                    })
                });
            const data = await response.json();
            const queryVector = data.embedding;
            const formattedVector = `[${queryVector.join(',')}]`;
            const similarDocs = await prisma.$queryRaw`
                SELECT id, title, content
                FROM "Document"
                WHERE "userId" = ${userId}::uuid
                ORDER BY embedding <=>${formattedVector}::vector
                LIMIT 3;` as unknown as any;

            const contentText = similarDocs.map((doc: any) => doc.content).join("\n---\n");

            const res = await ollama.chat({
                model: 'llama3.1',
                stream: true,
                messages: [
                    {
                        role: 'system',
                        content: `Sen katı kuralları olan bir asistansın.
                        Sana verilen BAĞLAM metnine bakarak kullanıcının sorusunu cevapla.
                        Kurallar:
                        1. Sadece ve sadece BAĞLAM metnindeki bilgileri kullan.
                        2. BAĞLAM metninde cevap yoksa "Bu konuda notlarınızda bilgi bulunmuyor" de.
                        3. Asla ekstra yorum yapma, konuyu uzatma ve uydurma (halüsinasyon görme).
                        4. Cevabın kısa, net ve Türkçe olsun.
                        BAĞLAM: ${contentText}`
                    },
                    {
                        role: 'user',
                        content: question
                    }
                ]
            });

            for await (const chunk of res) {
                socket.emit('answer_chunk', chunk.message.content);
            }

            socket.emit('answer_done');
        }
        catch (err: any) {
            console.error("SEARCH ERROR:", err.message || err);
        }
    });
});

app.post('/upload', async (req: Request, res: Response) => {
    const { userId, title, content } = req.body;
    try {
        const createdDoc = await prisma.document.create({
            data: {
                userId,
                title,
                content
            }
        });
        await document_queue.add('process', { documentId: createdDoc.id });
        return res.json({ message: "Document uploaded succesfully. AI processing has been queued." });
    }
    catch (err: any) {
        console.error("ERROR DETAIL:", err.message || err);
        return res.status(500).json({
            error: "An error occured!",
            message: err?.message || String(err),
            details: err
        });
    }
});

app.post('/search', async (req: Request, res: Response) => {
    const { userId, question } = req.body;

    try {
        const response = await
            fetch(process.env.OLLAMA_HOST + '/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    model: 'nomic-embed-text',
                    prompt: question
                })
            });
        const data = await response.json();
        const queryVector = data.embedding;
        const formattedVector = `[${queryVector.join(',')}]`;
        const similarDocs = await prisma.$queryRaw`
                SELECT id, title, content
                FROM "Document"
                WHERE "userId" = ${userId}::uuid
                ORDER BY embedding <=>${formattedVector}::vector
                LIMIT 3;`;

        return res.json({
            message: "Documents closest to the question found!",
            results: similarDocs
        });
    }
    catch (err: any) {
        console.error("SEARCH ERROR:", err.message || err);
        return res.status(500).json({ error: String(err) });
    }
});

httpServer.listen(port, () => {
    console.log(`Synapse app listening on port ${port}`);
});
