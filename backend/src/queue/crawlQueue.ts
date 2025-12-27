import Queue from "bull";
import dotenv from "dotenv";

dotenv.config();

export const crawlQueue = new Queue(
  "crawl-jobs",
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    redis: {
      maxRetriesPerRequest: null,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  },
);

// // Queue event listeners
// crawlQueue.on("global:completed", (jobId, result) => {
//   console.log(`Job ${jobId} completed with result:`, result);
// });

crawlQueue.on("global:failed", (jobId, err) => {
  console.error(`Job ${jobId} failed:`, err);
});
