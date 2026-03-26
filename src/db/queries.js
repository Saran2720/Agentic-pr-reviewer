import pool from "../db/index.js";

export async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      repo VARCHAR(255) NOT NULL,
      pr_number INTEGER NOT NULL,
      verdict VARCHAR(50),
      summary TEXT,
      files_reviewed INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_summaries (
      id SERIAL PRIMARY KEY,
      repo VARCHAR(255) NOT NULL,
      filename VARCHAR(500) NOT NULL,
      summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(repo, filename)
    )
  `);
}

export async function saveReview({
  repo,
  pr_number,
  verdict,
  summary,
  files_reviewed,
}) {
  const result = await pool.query(
    `
        INSERT INTO reviews (repo, pr_number, verdict, summary, files_reviewed)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
    [repo, pr_number, verdict, summary, files_reviewed],
  );
  return result.rows[0];
}

export async function upsertFileSummary({ repo, filename, summary }) {
  await pool.query(
    `INSERT INTO file_summaries (repo, filename, summary, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (repo, filename)
     DO UPDATE SET summary = $3, updated_at = NOW()`,
    [repo, filename, summary],
  );
}

export async function getFileSummaries({ repo, filenames }) {
  const result = await pool.query(
    `SELECT filename, summary FROM file_summaries
     WHERE repo = $1 AND filename = ANY($2)`,
    [repo, filenames],
  );
  return result.rows;
}
