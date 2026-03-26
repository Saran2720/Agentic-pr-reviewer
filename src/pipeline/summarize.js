import logger from "../utils/logger";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { upsertFileSummary } from "../db/queries";

dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); //initialize your LLM client here (e.g., OpenAI, Cohere, etc.)
export const summarizeFiles = async ({ repo, files }) => {
  logger.info("summarizing files for RAG", { repo, filesCount: files.length });

  for (const file of files) {
    //skip delted files and files with no diffs
    if (file.status === "removed" || !file.patch) {
      continue;
    }

    try {
      //summarize the file diff using LLM
      const response = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Summarize what this file does in 3 to 4 lines.Be concise and technical.
                    FileName:${file.filename}
                    Diff:${file.patch.slice(0, 2000)}
                    Reply with just the summary without any additional text.`,
          },
        ],
      });

      const summary = response.content[0].text.trim();
      await upsertFileSummary({ repo, filename: file.filename, summary });
      logger.info("File summarized ", { filename: file.filename });
    } catch (error) {
      logger.error("Failed to summarize file", {
        filename: file.filename,
        error: error.messages,
      });
    }
  }
};
