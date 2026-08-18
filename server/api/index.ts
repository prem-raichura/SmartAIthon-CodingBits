// Vercel serverless entry. @vercel/node serves an exported Express app directly,
// so no serverless-http wrapper is needed (that is AWS Lambda style).
import app from '../src/app.js';

export default app;
