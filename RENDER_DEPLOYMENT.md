# Render Deployment Guide

This guide will help you deploy CareerScope to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your GitHub repository connected to Render

## Environment Variables

Set these environment variables in your Render dashboard:

### Required Variables

- `NODE_ENV`: `production`
- `PORT`: `10000` (Render automatically sets this, but you can override)
- `CLIENT_URL`: Your Render app URL (e.g., `https://careerscope-xxxx.onrender.com`)
- `JWT_SECRET`: A strong random string for JWT token signing (generate one using: `openssl rand -base64 32`)
- `VITE_API_URL`: Your Render app URL with `/api` (e.g., `https://careerscope-xxxx.onrender.com/api`)

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. Connect your GitHub repository to Render
2. Render will automatically detect the `render.yaml` file
3. Set the environment variables in the Render dashboard
4. Deploy!

### Option 2: Manual Configuration

1. **Create a new Web Service** in Render
2. **Connect your GitHub repository**
3. **Configure the service:**
   - **Name**: `careerscope` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm run install:all && npm run build`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Starter (or higher for production)

4. **Set Environment Variables:**
   - Add all the variables listed above

5. **Deploy**

## Important Notes

### Database

- The app uses SQLite (`better-sqlite3`)
- SQLite files are stored in the `server/` directory
- **Note**: SQLite on Render is ephemeral - data will be lost on redeploy
- For production, consider migrating to PostgreSQL (Render offers free PostgreSQL)

### File Uploads

- Uploads are stored in the `uploads/` directory
- These are also ephemeral on Render
- Consider using a cloud storage service (AWS S3, Cloudinary, etc.) for production

### Build Process

The build process:
1. Installs all dependencies (root, client, server)
2. Builds the React client (`client/dist`)
3. Starts the Express server which serves the built client

### CORS Configuration

Make sure `CLIENT_URL` matches your actual Render app URL to avoid CORS issues.

## Post-Deployment

1. Visit your Render app URL
2. Test the health endpoint: `https://your-app.onrender.com/api/health`
3. Verify the frontend loads correctly
4. Test authentication and other features

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json` files
- Verify Node.js version compatibility (Render uses Node 18+ by default)

### Environment Variables Not Working
- Ensure variables are set in Render dashboard
- Restart the service after adding variables
- Check variable names match exactly (case-sensitive)

### CORS Errors
- Verify `CLIENT_URL` matches your Render URL exactly
- Check that `VITE_API_URL` is set correctly

### Database Issues
- SQLite database is created automatically on first run
- If database errors occur, check file permissions
- Consider using Render's PostgreSQL for persistent storage

## Production Recommendations

1. **Database**: Migrate to PostgreSQL for data persistence
2. **File Storage**: Use cloud storage (S3, Cloudinary) for uploads
3. **Environment Variables**: Use Render's environment variable groups
4. **Monitoring**: Enable Render's logging and monitoring
5. **SSL**: Render provides SSL certificates automatically
6. **Custom Domain**: Configure a custom domain in Render settings

