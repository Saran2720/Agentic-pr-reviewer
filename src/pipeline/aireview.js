import { buildreviewPrompt } from "./buildPrompt.js";
import { getRAGContext } from "./ragLookUp.js";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const callAIWithRetry = async (prompt, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const text = response.content[0].text;

      //parese JSON res
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (error) {
      logger.warn(`AI attempt ${attempt} failed`, { error: err.message });

      if (attempt === retries) throw err;

      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export async function revewFiles({ repo, files, prTitle, prDescription }) {
  const results = [];

  for (const file of files) {
    if (file.status === "removed" || !file.patch) continue;

    logger.info("Start reviweing file", { filename: file.filename });

    //get the rag context for this file
    const ragContext = await getRAGContext({
      repo,
      filename: file.filename,
      allFiles: files,
    });

    //build prompt
    const prompt = buildreviewPrompt({
      file,
      ragContext,
      prTitle,
      prDescription,
    });

    //call AI with retry
    const review = await callAIWithRetry(prompt);
    results.push({
      filename: file.filename,
      comments: review.comments || [],
      verdict: review.verdict || "approve",
      summary: review.summary || "",
    });

    logger.info("File reviewed", {
      filename: file.filename,
      verdict: review.verdict,
      commentsCount: review.comments?.length || 0,
    });
  }

  return results;
}
