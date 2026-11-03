import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postgresSql } from '../db/postgres.js';

test('placeholder conversion preserves SQL literals', () => {
  assert.equal(postgresSql("SELECT '?' AS question, id FROM users WHERE id = ? AND email = ?"), "SELECT '?' AS question, id FROM users WHERE id = $1 AND email = $2");
});
test('conflict-ignore writes return generated ids only when inserted', () => {
  assert.equal(postgresSql('INSERT OR IGNORE INTO student_career_interests (student_id, career_id) VALUES (?, ?)', true), 'INSERT INTO student_career_interests (student_id, career_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id');
});
test('aggregate conversion preserves legacy counselor path fields', () => {
  assert.equal(postgresSql('SELECT GROUP_CONCAT(career_id) FROM counselor_career_paths'), "SELECT STRING_AGG((career_id)::text, ',') FROM counselor_career_paths");
});
