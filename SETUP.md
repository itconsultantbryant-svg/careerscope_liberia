# CareerScope Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Installation

1. **Install root dependencies:**
   ```bash
   npm install
   ```

2. **Install all dependencies (client + server):**
   ```bash
   npm run install:all
   ```

   Or manually:
   ```bash
   cd client && npm install && cd ..
   cd server && npm install && cd ..
   ```

## Configuration

1. **Server Environment Variables:**
   - Copy `server/.env.example` to `server/.env` (if needed)
   - Default values are already set in `server/.env`

2. **Client Environment Variables:**
   - The client uses `http://localhost:5000/api` by default
   - To customize, create `client/.env` with:
     ```
     VITE_API_URL=http://localhost:5000/api
     ```

## Running the Application

### Development Mode (Both Frontend & Backend)

```bash
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

### Run Separately

**Frontend only:**
```bash
npm run dev:client
```

**Backend only:**
```bash
npm run dev:server
```

## Default Admin Credentials

- **Email:** `admin@careerscope.lib`
- **Password:** `Liberia2025!`

## Database

The SQLite database (`sqlite.db`) will be automatically created on first server start. It includes:
- Default admin user
- Sample career data
- All necessary tables

## Features

✅ User Authentication (JWT + httpOnly cookies)
✅ Student Registration & Dashboard
✅ Counselor Registration & Dashboard
✅ Admin Dashboard
✅ Career Explorer
✅ Community Feed (Posts, Likes, Comments)
✅ Appointment Booking System
✅ Offline Support (cached data)
✅ Mobile-first Responsive Design

## Project Structure

```
CareerScope01/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express backend
├── shared/          # Shared types/utilities
├── uploads/         # User-uploaded files
└── sqlite.db        # SQLite database (created on first run)
```

## Troubleshooting

1. **Port already in use:**
   - Change ports in `server/.env` (PORT) and `client/vite.config.js`

2. **Database errors:**
   - Delete `sqlite.db` and restart server (will recreate)

3. **CORS issues:**
   - Ensure `CLIENT_URL` in `server/.env` matches your frontend URL

4. **Module not found:**
   - Run `npm run install:all` again

## Production Build

```bash
cd client && npm run build
```

The built files will be in `client/dist/`

## Notes

- All images are stored locally in `/uploads`
- Offline support uses localStorage for caching
- Payment integration is mocked (Mobile Money simulation)

