import 'dotenv/config';
import { Worker,Job } from "bullmq";
import { document_queue } from "./queue.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from './generated/prisma/client/client.js';

const adapter = new PrismaPg({ connectionString:process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379
}

const docWorker = new Worker(document_queue.name, async (job: Job) => {
    const documentId = job.data.documentId;

    const doc = await prisma.document.findUnique({
        where: {id: documentId}
    });

    if(doc) {
        console.log(`\n [WORKER] AI processing the document...`);
        console.log(`[WORKER] Title: ${doc.title}`);
        console.log(`[WORKER] Content lenght: ${doc.content.length} character`);

        console.log("[WORKER] Text sending to Ollama...");
        const response = await fetch(process.env.OLLAMA_HOST + '/api/embeddings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model: 'nomic-embed-text',
                prompt: doc.content
            })
        });
        const data = await response.json();
        const embeddingArray = data.embedding;

        console.log(`[WORKER] Vector created! Size: ${embeddingArray.length}`);

        const formattedVector = `[${embeddingArray.join(',')}]`;
        await prisma.$executeRaw`UPDATE "Document" SET embedding = ${formattedVector}::vector WHERE id = ${doc.id}::uuid`;

        console.log(`[WORKER] The vector was successfully written to the database!`);
    }
},{connection});

docWorker.on('completed', (job: Job) => {
    console.log(`[WORKER] Process end succesfully! (Job ID: ${job.id})`);
});