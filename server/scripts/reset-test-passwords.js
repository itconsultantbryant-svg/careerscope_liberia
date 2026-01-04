import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../sqlite.db');
const db = new Database(dbPath);

// Reset passwords for test users
const testUsers = [
  {
    phone: '0778889990', // John Brown (student)
    password: 'student123',
    role: 'student'
  },
  {
    phone: '0775592486', // Sam Brown (counselor)
    password: 'counselor123',
    role: 'counselor'
  }
];

console.log('🔄 Resetting test user passwords...\n');

for (const user of testUsers) {
  const existingUser = db.prepare('SELECT id, first_name, last_name, role FROM users WHERE phone = ?').get(user.phone);
  
  if (existingUser) {
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    db.prepare('UPDATE users SET password = ? WHERE phone = ?').run(hashedPassword, user.phone);
    console.log(`✅ Reset password for ${existingUser.first_name} ${existingUser.last_name} (${existingUser.role})`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Password: ${user.password}\n`);
  } else {
    console.log(`⚠️  User with phone ${user.phone} not found\n`);
  }
}

console.log('✅ Password reset complete!');
db.close();

