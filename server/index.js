import 'dotenv/config';

if (process.env.DATABASE_URL) {
  const { default: app } = await import('./app.js');
  app.listen(process.env.PORT || 5000, () => console.log('CareerScope PostgreSQL API ready'));
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is required in production. SQLite fallback is disabled.');
} else {
  await import('./legacy-index.js');
}
