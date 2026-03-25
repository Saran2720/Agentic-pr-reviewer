import express from "express";
import dotenv from "dotenv";
import logger from "./utils/logger";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { verifySignature } from "./middleware/verifySignature.js";
import { createTables } from "./db/queries";
import { addReviewJob } from './queue/reviewQueue.js'

dotenv.config();

const app = express();
app.use(express.json());

//health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/webhook", rateLimiter, verifySignature, async (req, res) => {
  const { action, pull_request, repository } = req.body;

  const relaventActions = ["opened", "edited", "reopened"];
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

  const PORT = process.env.PORT || 3000;

  async function start() {
    await createTables();
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  }

  start().catch((err) => {
    logger.error("Failed to start server", { error: err });
    process.exit(1);
  });
});

export default app;
