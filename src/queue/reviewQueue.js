import Bull from "bull";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const reviewQueue = new Bull("reviewQueue", {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    attempts: 3, // retry 3 times if job fails
    backoff: {
      type: "exponential", // wait longer between each retry
      delay: 5000, // start with 5 seconds
    },
    removeOnComplete: true, // clean up finished jobs
    removeOnFail: false, //keep failed jobs for debugging
  },
});

//queue event listeners for logging
reviewQueue.on("completed", (job) => {
  logger.info("Review job completed", {
    jobId: job.id,
    repo: job.data.repo,
    prNumber: job.data.prNumber,
  });
});

reviewQueue.on("failed", (job) => {
  logger.error("Review job failed", {
    jobId: job.id,
    repo: job.data.repo,
    prNumber: job.data.prNumber,
    error: job.failedReason,
  });
});

reviewQueue.on("stalled", (job) => {
  logger.warn("Review job stalled", {
    jobId: job.id,
    repo: job.data.repo,
    prNumber: job.data.prNumber,
  });
});


export async function addReviewJob({ repo, prNumber, prTitle }) {
    const job = await reviewQueue.add({ repo, prNumber, prTitle });
    logger.info("Added review job to queue", {
      jobId: job.id,
      repo,
      prNumber,
    });
    return job;
}

export default reviewQueue;