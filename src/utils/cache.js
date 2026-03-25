import Redis from "ioredis";
import logger from "./logger.js";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => logger.info("Connected to Redis cache"));
redis.on("error", (err) => logger.error("Redis error", { error: err }));

const CACHE_TTL = 3600; // 1 hour

//getCache
export async function getCache(key) {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

//setCache
export async function setCache(key, value) {
  await redis.set(key, JSON.stringify(value), "EX", CACHE_TTL);
}

export default redis;
