import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import logger from "../utils/logger.js";

dotenv.config();

const octoKit = new Octokit({ auth: process.env.GITHUB_TOKEN });

//posting inline comment in github
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

//posting overall summary comment on the PR
// sample data to send=>
// ## AI PR Review ❌

// Overall Verdict: REQUEST CHANGES

// Files Reviewed: 3
// Issues Found: 3
// Approved: 2
// Needs Changes: 1

// File Summaries

// src/App.jsx
// Code looks clean.

// src/utils.js
// Function too long.
export const postSummaryComment = async ({ repo, prNumber, reviewResults }) => {
  const [owner, reponame] = repo.split("/");

  const approvedFiles = reviewResults.filter(
    (f) => f.verdict === "approve",
  ).length;
  const changesNeeded = reviewResults.filter(
    (f) => f.verdict === "request_changes",
  ).length;
  const totalComments = reviewResults.reduce(
    (sum, f) => sum + f.comments.length,
    0,
  );

  const overallVerdict = changesNeeded > 0 ? "REQUEST CHANGES" : "APPROVED";
  const verdictEmoji = changesNeeded > 0 ? "❌" : "✅";

  const fileSummaries = reviewResults
    .map((f) => `**${f.filename}**\n ${f.summary}`)
    .join("\n\n");

  const body = `## AI PR Review ${verdictEmoji}
                **Overall Verdict: ${overallVerdict}

                | Files Reviewed | Issues Found | Approved | Needs Changes |
                |---|---|---|---|
                | ${reviewResults.length} | ${totalComments} | ${approvedFiles} | ${changesNeeded} |
                ---

                ### File Summaries 

                ${fileSummaries}
                ---
                *Reviewed by AI PR Reviewer Bot*
               `;

  await octoKit.issues.createComment({
    owner,
    repo: reponame,
    issue_number: prNumber,
    body,
  });

  logger.info("Summary comment posted", { repo, prNumber });
};

export async function submitReview({ repo, prNumber, reviewResults }) {
  const [owner, reponame] = repo.split("/");

  const changesNeeded = reviewResults.some(
    (f) => f.verdict === "request_changes",
  );
  const event = changesNeeded ? "REQUEST_CHANGES" : "APPROVE";
  const body = changesNeeded
    ? "AI review found issues that should be addressed before merging."
    : "AI review passed. Code looks good to merge!";

  const { data: pr } = await octoKit.pulls.get({
    owner,
    repo: reponame,
    pull_number: prNumber,
  });

  const commitId = pr.head.sha;

  await octoKit.pulls.createReview({
    owner,
    repo: reponame,
    pull_number: prNumber,
    commit_id: commitId,
    event,
    body,
  });

  logger.info("Review submitted", { repo, prNumber, event });
}


export async function applyLabels({ repo, prNumber, reviewResults }) {
  const [owner, repoName] = repo.split('/')

  const changesNeeded = reviewResults.some((r) => r.verdict === 'request_changes')
  const hasCritical = reviewResults.some((r) =>
    r.comments.some((c) => c.severity === 'critical')
  )

  const labels = []
  if (hasCritical) labels.push('security-issue')
  if (changesNeeded) labels.push('needs-fix')
  if (!changesNeeded) labels.push('approved')

  // Create labels if they don't exist yet
  for (const label of labels) {
    try {
      await octokit.issues.createLabel({
        owner,
        repo: repoName,
        name: label,
        color: label === 'approved' ? '0075ca'
          : label === 'needs-fix' ? 'e4e669'
          : 'd73a4a'
      })
    } catch {
      // Label already exists, that's fine
    }
  }

  await octokit.issues.addLabels({
    owner,
    repo: repoName,
    issue_number: prNumber,
    labels
  })

  logger.info('Labels applied', { repo, prNumber, labels })
}