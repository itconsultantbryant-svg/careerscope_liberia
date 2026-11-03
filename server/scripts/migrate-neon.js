// One-time, explicit migration into an EMPTY Neon database. Never drops source
// tables, overwrites existing PostgreSQL tables, or prints connection secrets.
import 'dotenv/config';
import Database from 'better-sqlite3';
import pg from 'pg';
import { resolve } from 'node:path';

const sourcePath = resolve(process.env.SQLITE_SOURCE_PATH || 'sqlite.db');
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const violations = source.pragma('foreign_key_check');
if (violations.length) throw new Error(`Source database has ${violations.length} foreign-key violations. Resolve these before migrating.`);
const tables = source.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all();
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const ddl = (sql) => sql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY').replace(/\bDATETIME\b/gi, 'TEXT').replace(/\bBOOLEAN\b/gi, 'INTEGER');

if (process.argv.includes('--dry-run')) {
  console.log('Source schema and row counts (no cloud writes):');
  for (const table of tables) console.log(`${table.name}: ${source.prepare(`SELECT COUNT(*) AS count FROM ${quote(table.name)}`).get().count}`);
  source.close();
} else {
  if (!process.argv.includes('--confirm-empty-target')) throw new Error('Pass --confirm-empty-target after backing up the source and confirming the target project');
  if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('DATABASE_URL_UNPOOLED is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
  try {
    await client.connect();
    await client.query('BEGIN');
    const existing = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (existing.rows.length) throw new Error('Target database is not empty. No changes have been made.');
    for (const table of tables) await client.query(ddl(table.sql));
    for (const table of tables) {
      const rows = source.prepare(`SELECT * FROM ${quote(table.name)}`).all();
      for (const row of rows) {
        const columns = Object.keys(row);
        await client.query(`INSERT INTO ${quote(table.name)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')})`, Object.values(row));
      }
      const serial = await client.query('SELECT pg_get_serial_sequence($1, $2) AS sequence', [table.name, 'id']);
      if (serial.rows[0].sequence) {
        await client.query(`SELECT setval($1, GREATEST(COALESCE((SELECT MAX(id) FROM ${quote(table.name)}), 0), 1), EXISTS(SELECT 1 FROM ${quote(table.name)}))`, [serial.rows[0].sequence]);
      }
      const count = await client.query(`SELECT COUNT(*)::integer AS count FROM ${quote(table.name)}`);
      if (count.rows[0].count !== rows.length) throw new Error(`Row count mismatch: ${table.name}`);
      console.log(`${table.name}: verified ${rows.length} rows`);
    }
    await client.query('COMMIT');
    console.log('Migration committed. Source SQLite is unchanged. API PostgreSQL conversion is a separate deployment gate.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
    source.close();
  }
}
