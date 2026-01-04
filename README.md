# CareerScope – Career Counseling Platform for Liberian High School Students

**Mission**: Help Liberian students discover career paths, connect with mentors, access local opportunities, and make informed decisions after WASSCE.

## Tech Stack

- **Frontend**: React.js (Vite), Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Node.js + Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT + HTTP-only cookies
- **State Management**: React Context API
- **Routing**: React Router DOM v6
- **Forms**: React Hook Form + Zod validation

## Project Structure

```
/careerscope
├── /client        → React + Vite frontend
├── /server        → Node.js + Express + SQLite backend
├── /shared        → Types, validation schemas
├── /uploads       → Profile pictures, post images
└── sqlite.db      → SQLite database file
```

## Getting Started

### Install Dependencies

```bash
npm run install:all
```

### Development

Run both frontend and backend concurrently:

```bash
npm run dev
```

Or run separately:

```bash
# Frontend only
npm run dev:client

# Backend only
npm run dev:server
```

### Default Admin Credentials

- Email: `admin@careerscope.lib`
- Password: `Liberia2025!`

## Features

- 🎓 Career exploration and recommendations
- 👥 Counselor matching and booking
- 💬 Community feed with posts, likes, and comments
- 📅 Appointment scheduling
- 💰 Mobile Money payment integration (mock)
- 📱 Mobile-first responsive design
- 🌐 Offline support for low-internet environments

## License

MIT

