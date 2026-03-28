import logger from "../utils/logger.js";
import dotenv from "dotenv";
import { upsertFileSummary } from "../db/queries.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cli } from "winston/lib/winston/config/index.js";

dotenv.config();

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); //initialize your LLM client here (e.g., OpenAI, Cohere, etc.)
const AiModel = client.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

export const summarizeFiles = async ({ repo, files }) => {
  logger.info("summarizing files for RAG", { repo, filesCount: files.length });

  for (const file of files) {
    //skip delted files and files with no diffs
    if (file.status === "removed" || !file.patch) {
      continue;
    }

    try {
      //summarize the file diff using LLM

      const result = AiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Summarize what this file does in 3 to 4 lines. Be concise and technical.
FileName: ${file.filename}
Diff: ${file.patch.slice(0, 2000)}
Reply with just the summary without any additional text.`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.5,
        },
      });

      const summary = result?.response.text();

      if (!summary) {
        logger.warn("Empty summary from AI", { filename: file.filename });
        continue;
      }

      await upsertFileSummary({ repo, filename: file.filename, summary });
      logger.info("File summarized ", { filename: file.filename });
    } catch (error) {
      logger.error("Failed to summarize file", {
        filename: file.filename,
        error: error.message,
      });
    }
  }
};
