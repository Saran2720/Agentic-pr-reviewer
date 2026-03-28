import crypto from "crypto";
import logger from "../utils/logger.js";
import dotenv from "dotenv"

dotenv.config();

export function verifySignature(req, res, next) {
  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    logger.warn("Webhook received with no signature");
    return res.status(400).json({ error: "No signature provided" });
  }

  const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET);
  const digest =
    "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");

  const truseted = Buffer.from(digest);
  const received = Buffer.from(signature);
  if (
    truseted.length !== received.length ||
    !crypto.timingSafeEqual(truseted, received)
  ) {
    logger.warn("Invalid webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  next();
}
