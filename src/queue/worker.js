import { fetchPRData } from "../pipeline/fetchPR.js";
import { summarizeFiles } from "../pipeline/summarize.js";
import logger from "../utils/logger.js";
import reviewQueue from "./reviewQueue.js";


reviewQueue.process(async (job)=>{
    const { repo, prNumber, prTitle } = job.data;
    logger.info("Processing review job", { repo, prNumber, prTitle });

    //fetch PR data from github
    try{
        // STEP1: fetch PR data from github
        const prData = await fetchPRData({ repo, prNumber });
        logger.info("PR data fetched successfully", { repo, prNumber, prTitle });

        // STEP2: summarize the changed files using LLM
        await summarizeFiles({repo,files:prData.files});
        logger.info("Files summarized successfully", { repo, prNumber, prTitle });




        logger.info("Review job finished",{repo, prNumber, prTitle});

    }catch(err){
        logger.error("Failed to process review job", {
            repo,
            prNumber,
            prTitle,
            error: err.message
        });
    }
    logger.info('Worker is running and waiting for jobs...')
})