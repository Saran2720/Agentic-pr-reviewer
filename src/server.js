import express from "express";
import dotenv from "dotenv";
import logger from "./utils/logger.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { verifySignature } from "./middleware/verifySignature.js";
import { createTables } from "./db/queries.js";
import redis from "./utils/cache.js";
import { addReviewJob } from './queue/reviewQueue.js'
import './queue/worker.js';
dotenv.config();

const app = express();
app.use(express.json());

//health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/webhook", rateLimiter, verifySignature, async (req, res) => {
  const { action, pull_request, repository } = req.body;

  const relaventActions = ["opened", "synchronize", "reopened"];
  if (!relaventActions.includes(action)) {
    return res.status(200).json({ message: "Action ignored" });
  }

  const repo = repository.full_name;
  const prNumber = pull_request.number;
  const prTitle = pull_request.title;

  logger.info("Received webhook", { repo, prNumber, prTitle, action });

  //add to enqueuing
  await addReviewJob({ repo, prNumber, prTitle });

  //respond immediately to github
  return res.status(200).json({ message: "Webhook received" });
});


const PORT = process.env.PORT || 3000;

  async function start() {
    try {

      await redis.ping();
      logger.info("Connected to Redis successfully");

      await createTables();
      logger.info("Database tables ready");

      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
      });
    } catch (err) {
      logger.error("Failed to start server", { error: err.message });
      process.exit(1);
    }
  }

  start();

export default app;
