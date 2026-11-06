import { pool } from './postgres.js';
import { readFile } from 'node:fs/promises';
import { careers } from './careers-data.js';
import { questions } from '../generated/assessment-seed.js';
import { seedAiCounselors } from './ai-seed.js';

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('careerscope-schema-v2'))");
    await client.query(await readFile(new URL('../generated/schema.sql', import.meta.url), 'utf8'));
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_versions (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country text DEFAULT 'Liberia';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_name text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_phone text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS student_number text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_goals text;
      ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT 'Unspecified';
      ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS company_snapshot text;
      ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT 'Unspecified';
      ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS company_snapshot text;
      CREATE UNIQUE INDEX IF NOT EXISTS billing_invoice_active_payment ON billing_payments(invoice_id) WHERE invoice_id IS NOT NULL AND status IN ('pending', 'approved');
      CREATE TABLE IF NOT EXISTS uploaded_files (
        filename text PRIMARY KEY, owner_id integer NOT NULL REFERENCES users(id),
        purpose text NOT NULL CHECK(purpose IN ('profile','post','group','message')),
        mime_type text NOT NULL, original_name text NOT NULL,
        content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS realtime_events (
        id bigserial PRIMARY KEY, user_id integer REFERENCES users(id) ON DELETE CASCADE,
        event text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS realtime_events_user_id ON realtime_events(user_id, id);
      CREATE INDEX IF NOT EXISTS realtime_events_created_at ON realtime_events(created_at);
      INSERT INTO schema_versions(version) VALUES (2) ON CONFLICT DO NOTHING;
    `);
    if (!(await client.query('SELECT version FROM schema_versions WHERE version = 3')).rowCount) {
      await client.query(await readFile(new URL('./features.sql', import.meta.url), 'utf8'));
    }
    if (!(await client.query('SELECT id FROM careers LIMIT 1')).rowCount) {
      for (const career of careers) await client.query('INSERT INTO careers(title, description, job_outlook, required_education, salary_range, skills_required, universities, category) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [career.title, career.description, career.job_outlook || null, career.required_education || null, career.salary_range || null, career.skills_required || null, career.universities || null, career.category || null]);
    }
    if (!(await client.query('SELECT id FROM quiz_questions LIMIT 1')).rowCount) {
      for (const question of questions) await client.query('INSERT INTO quiz_questions(question, options, career_category, points) VALUES ($1,$2,$3,$4)', [question.question, question.options, question.career_category, question.points]);
    }
    await seedAiCounselors(client);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

if (process.argv.includes('--apply')) {
  await migrate();
  console.log('PostgreSQL migrations applied.');
  await pool.end();
}
