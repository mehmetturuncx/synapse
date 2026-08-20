import { Queue } from "bullmq";

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: 6379
}

export const document_queue = new Queue('documentQueue', {connection});
