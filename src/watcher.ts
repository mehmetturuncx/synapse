import 'dotenv/config'
import chokidar from 'chokidar'
import fs from 'fs';
import path from 'path';
import { PrismaClient } from './generated/prisma/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { document_queue } from './queue.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const fileLocation = process.env.WATCH_DIR || "./default-watch";
const watcher = chokidar.watch(fileLocation,{persistent:true,ignoreInitial:false});

watcher.on('add', async (fileLocation) => {
    if(path.extname(fileLocation) !== ".md") return;
    const content = fs.readFileSync(fileLocation, 'utf-8');
    const title = path.basename(fileLocation);

    const createdDoc = await prisma.document.create({
        data: {
            title,
            content,
            userId: "ba5282ea-99db-409a-86bc-5f1438899c8e"
        }
    });
    await document_queue.add('process', {documentId: createdDoc.id});
    console.log("New file added: ",fileLocation);
});

watcher.on('change', async (fileLocation) => {
    if(path.extname(fileLocation) !== ".md") return;
    const content = fs.readFileSync(fileLocation, 'utf-8');
    const title = path.basename(fileLocation);

    await prisma.document.updateMany({
        where: {title},
        data: {content}
    });

    const updatedDoc = await prisma.document.findFirst({
        where: {title}
    });

    await document_queue.add('process', {documentId: updatedDoc?.id});  
    console.log("File updated: ",fileLocation);
});