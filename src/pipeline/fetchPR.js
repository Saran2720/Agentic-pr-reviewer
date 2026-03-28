import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { getCache, setCache } from "../utils/cache.js";

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function fetchPRData({ repo, prNumber }) {
  const cacheKey = `pr:${repo}:${prNumber}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    logger.info("Cache hit for PR data", { repo, prNumber });
    return cached;
  }

  const [owner, repoName] = repo.split("/");
 
    //fecth PR data from github
    const { data: pr }= await octokit.pulls.get({
      owner,
      repo: repoName,
      pull_number: prNumber,
    })

  
  //fetch changed files and their diff
 
  
    const { data: files }= await octokit.pulls.listFiles({
      owner,
      repo: repoName,
      pull_number: prNumber,
    });

  const prData = {
    title: pr.title,
    description: pr.body || "",
    author: pr.user.login,
    baseBranch: pr.base.ref,
    files: files.map((file) => ({
      filename: file.filename,
      status: file.status,
      patch: file.patch || "",  // the actual diff for the file, can be empty for binary files or if the patch is too large
    })),
  };

  //cache the pr data
    await setCache(cacheKey, prData);
    logger.info("Pr data fetched from github and cached", { repo, prNumber, filesCount: files.length });
    return prData;
}
