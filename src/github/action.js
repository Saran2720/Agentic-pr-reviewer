import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import logger from "../utils/logger";

dotenv.config();

const octoKit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export const postInlineComment = async ({ repo, prNumber, reviewResults }) => {
  const [owner, repoName] = repo.split("/");

  //get the lastest commit SHA of the PR
  const { data: pr } = await octoKit.pulls.get({
    owner,
    repo: repoName,
    pull_number: prNumber,
  });
  const commitId = pr.head.sha;

  const comments = [];

  for (const fileReview of reviewResults) {
    for (const comment of fileReview) {
      if (!comment.line || !comment.issue) continue;

      comments.push({
        path: fileReview.filename,
        line: comment.line,
        body: `**${comment.severity?.toUpperCase() || "NOTE"}**\n\n${comment.issue}\n\n**Suggestion:**${comment.suggestion}`,
      });
    }
  }

  if (comments.length == 0) {
    logger.info("No inline comments to post", { repo, prNumber });
  }

  //post all comments as a single review
  await octoKit.pulls.createReview({
    owner,
    repo: repoName,
    pull_number: prNumber,
    commit_id: commitId,
    event: "COMMENT",
    comments,
  });
  logger.info("Inline comments posted", {
    repo,
    prNumber,
    count: comments.length,
  });
};
