import Redis from "ioredis";
import logger from "./logger.js";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL, {
  tls: {},
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 500, 2000);
  },
  reconnectOnError(err) {
    logger.warn("Redis reconnecting:", { error: err.message });
    return true;
  },
});

redis.on("connect", () => logger.info("Connected to Redis cache"));
redis.on("error", (err) => logger.error("Redis error", { error: err.message }));

//temporary test
redis
  .ping()
  .then((result) => {
    logger.info(`Redis ping response:${result}`);
  })
  .catch((err) => {
    logger.error("Redis ping failed", { error: err.message });
  });

const CACHE_TTL = 3600; // 1 hour

//getCache
export async function getCache(key) {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

//setCache
export async function setCache(key, value) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", CACHE_TTL);
  } catch {}
}

export default redis;
