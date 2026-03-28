import logger from "../utils/logger.js";
import { buildreviewPrompt } from "./buildPrompt.js";
import { getRAGContext } from "./ragLookUp.js";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); //initialize your LLM client here (e.g., OpenAI, Cohere, etc.)
const AiModel = client.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

const callAIWithRetry = async (prompt, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      //sending details to LLM with cofig like tokens and temperature
      const result = AiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      });
      const text = result.response.text();

      //parese JSON res
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch (err) {
      logger.warn(`AI attempt ${attempt} failed`, { error: err.message });

      if (attempt === retries) throw err;

      // Wait longer if rate limited (429)
      const delay =
        err.status == 429
          ? 10000 // wait 10 seconds if rate limited
          : Math.min(2, attempt) * 1000; // normal exponential backoff
      logger.info(`Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export async function revewFiles({ repo, files, prTitle, prDescription }) {
  const results = [];

  for (const file of files) {
    if (file.status === "removed" || !file.patch) continue;

    logger.info("Start reviweing file", { filename: file.filename });

    try {
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
    } catch (err) {
      logger.warn("AI review failed for file, using fallback", {
        filename: file.filename,
      });
      results.push({
        filename: file.filename,
        comments: [],
        verdict: "approve",
        summary: "AI review unavailable for this file.",
      });
    }
  }

  return results;
}
