ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS counseling_completed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS counselor_type text NOT NULL DEFAULT 'human' CHECK (counselor_type IN ('human', 'ai'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS counselor_level integer NOT NULL DEFAULT 1 CHECK (counselor_level BETWEEN 1 AND 10);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(lower(username)) WHERE username IS NOT NULL;
ALTER TABLE counselor_career_paths ADD COLUMN IF NOT EXISTS career_level integer NOT NULL DEFAULT 1 CHECK (career_level BETWEEN 1 AND 10);

CREATE TABLE IF NOT EXISTS counselor_assignments (
  id serial PRIMARY KEY,
  student_id integer NOT NULL REFERENCES users(id),
  counselor_id integer NOT NULL REFERENCES users(id),
  career_id integer REFERENCES careers(id) ON DELETE SET NULL,
  career_level integer NOT NULL DEFAULT 1 CHECK (career_level BETWEEN 1 AND 10),
  is_active integer NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, counselor_id)
);
INSERT INTO counselor_assignments(student_id, counselor_id)
SELECT DISTINCT student_id, counselor_id FROM appointments WHERE status IN ('accepted','completed')
ON CONFLICT DO NOTHING;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_id integer REFERENCES users(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Monrovia';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
UPDATE appointments SET created_by_id = student_id WHERE created_by_id IS NULL;
UPDATE appointments SET starts_at = (appointment_date || ' ' || appointment_time)::timestamp AT TIME ZONE 'Africa/Monrovia',
  ends_at = ((appointment_date || ' ' || appointment_time)::timestamp AT TIME ZONE 'Africa/Monrovia') + interval '1 hour'
WHERE starts_at IS NULL AND appointment_date ~ '^\d{4}-\d{2}-\d{2}$' AND appointment_time ~ '^\d{2}:\d{2}';

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS valid_from date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS valid_until date NOT NULL DEFAULT (CURRENT_DATE + 90);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Monrovia';
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS planning_changes (
  id bigserial PRIMARY KEY, entity_type text NOT NULL CHECK(entity_type IN ('appointment','schedule')),
  entity_id integer NOT NULL, actor_id integer NOT NULL REFERENCES users(id),
  revision integer NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_path text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK(type IN
  ('assignment','quiz','grade','appointment','session','message','report','schedule','payment','archive','system'));

CREATE TABLE IF NOT EXISTS call_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), host_id integer NOT NULL REFERENCES users(id),
  title text NOT NULL, call_type text NOT NULL CHECK(call_type IN ('voice','video')),
  appointment_id integer REFERENCES appointments(id), schedule_id integer REFERENCES schedules(id), occurrence_date date,
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','ended')),
  started_at timestamptz, ended_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((appointment_id IS NOT NULL)::integer + (schedule_id IS NOT NULL)::integer = 1),
  CHECK(ends_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS call_rooms_appointment ON call_rooms(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS call_rooms_schedule ON call_rooms(schedule_id, occurrence_date) WHERE schedule_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS call_room_members (
  room_id uuid NOT NULL REFERENCES call_rooms(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES users(id),
  first_joined_at timestamptz, last_seen_at timestamptz, left_at timestamptz,
  hand_raised boolean NOT NULL DEFAULT false, mic_muted boolean NOT NULL DEFAULT false,
  screen_sharing boolean NOT NULL DEFAULT false,
  PRIMARY KEY(room_id, user_id)
);
CREATE TABLE IF NOT EXISTS archive_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id integer NOT NULL REFERENCES users(id),
  room_id uuid REFERENCES call_rooms(id) ON DELETE SET NULL,
  title text NOT NULL, kind text NOT NULL CHECK(kind IN ('note','file','call_note','transcript')),
  content text NOT NULL DEFAULT '', file_content bytea, mime_type text, original_name text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(file_content IS NULL OR octet_length(file_content) <= 3145728)
);
CREATE INDEX IF NOT EXISTS archive_documents_owner ON archive_documents(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS archive_room_note ON archive_documents(owner_id, room_id, kind) WHERE room_id IS NOT NULL AND kind IN ('call_note','transcript');

ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS payer_institution text;
ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS payer_details text;
ALTER TABLE billing_allocations ADD COLUMN IF NOT EXISTS student_name_snapshot text;
ALTER TABLE billing_invoice_items ADD COLUMN IF NOT EXISTS student_name_snapshot text;
UPDATE billing_allocations a SET student_name_snapshot = u.first_name || ' ' || u.last_name FROM users u WHERE u.id = a.student_id AND a.student_name_snapshot IS NULL;
UPDATE billing_invoice_items i SET student_name_snapshot = u.first_name || ' ' || u.last_name FROM users u WHERE u.id = i.student_id AND i.student_name_snapshot IS NULL;

CREATE TABLE IF NOT EXISTS ai_counselor_profiles (
  user_id integer PRIMARY KEY REFERENCES users(id), slug text NOT NULL UNIQUE,
  specialty text NOT NULL, system_prompt text NOT NULL, is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id integer NOT NULL REFERENCES users(id),
  counselor_id integer NOT NULL REFERENCES ai_counselor_profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(student_id, counselor_id)
);
CREATE TABLE IF NOT EXISTS ai_messages (
  id bigserial PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('user','assistant')), content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_audit_events (
  id bigserial PRIMARY KEY, actor_id integer NOT NULL REFERENCES users(id), action text NOT NULL,
  target_id integer, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_versions(version) VALUES (3) ON CONFLICT DO NOTHING;
