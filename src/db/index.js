import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';


dotenv.config();

const pool= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
})

pool.on('connect',()=>{
    logger.info('Connected to the database');
})

pool.on('error',(err)=>{
    logger.error('Database error', { error: err });
})

export default pool;