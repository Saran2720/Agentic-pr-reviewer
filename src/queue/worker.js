import { saveReview } from "../db/queries.js";
import { applyLabels, postInlineComment, postSummaryComment, submitReview } from "../github/action.js";
import { revewFiles } from "../pipeline/aireview.js";
import { fetchPRData } from "../pipeline/fetchPR.js";
import { summarizeFiles } from "../pipeline/summarize.js";
import logger from "../utils/logger.js";
import reviewQueue from "./reviewQueue.js";

reviewQueue.process(async (job) => {
  const { repo, prNumber, prTitle } = job.data;
  logger.info("Processing review job", { repo, prNumber, prTitle });
  
  //fetch PR data from github
  try {
    // STEP1: fetch PR data from github
    const prData = await fetchPRData({ repo, prNumber });
    logger.info("PR data fetched successfully", { repo, prNumber, prTitle });

    // STEP2: RAG- summarize the changed files using LLM
    await summarizeFiles({ repo, files: prData.files });
    logger.info("Files summarized successfully", { repo, prNumber, prTitle });

    //STEP3: AI review each files (rag context, prompt will happen inside)
    const reviewResults = await revewFiles({
      repo,
      files: prData.files,
      prTitle: prData.prTitle,
      prDescription: prData.prDescription,
    });

    //STEP4 -> Posting result to GITHUB
    await postInlineComment({repo,prNumber, reviewResults});
    await postSummaryComment({repo, prNumber,reviewResults});
    await submitReview({repo, prNumber,reviewResults});
    await applyLabels({repo,prNumber,reviewResults});


    // STEP 5 — Save review to DB
    const overallVerdict = reviewResults.some((r) => r.verdict === 'request_changes')
      ? 'request_changes'
      : 'approve'

    await saveReview({
      repo,
      prNumber,
      verdict: overallVerdict,
      summary: reviewResults.map((r) => r.summary).join(' | '),
      filesReviewed: reviewResults.length
    })
    logger.info('Review saved to database', { repo, prNumber })


    //final logger
    logger.info("Review job finished", { repo, prNumber, prTitle });
  } 
  
  catch (err) {
    logger.error("Failed to process review job", {
      repo,
      prNumber,
      prTitle,
      error: err.message,
    });
  }

});

logger.info("Worker is running and waiting for jobs...");
