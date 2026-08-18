import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from './generated/prisma/client/client.js';
import { document_queue } from './queue.js';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app: Express = express();
const port = 3000;
app.use(express.json());

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

app.post('/search', async (req: Request, res:
    Response) => {
    const { userId, question } = req.body;

    try {
        const response = await
            fetch('http://localhost:11434/api/embeddings', {
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

app.listen(port, () => {
    console.log(`Synapse app listening on port ${port}`);
});
