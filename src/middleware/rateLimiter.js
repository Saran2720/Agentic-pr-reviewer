import rateLimit from "express-rate-limit";
import logger from "../utils/logger.js";

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1minute
  max: 20, //20 requests per minute
  keyGenerator: (req) => {
    return req.body?.repository?.full_name || 'Global'; //Use repo name if available, otherwise skip IP entirely
  },
  skip:(req)=>{
    return false;
  },
  validate:{xForwardedForHeader:false},
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      repo: req.body?.repository?.full_name,
    });
    res
      .status(429)
      .json({ error: "Too many requests, please try again later." });
  },
});
