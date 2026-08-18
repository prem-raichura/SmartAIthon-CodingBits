import { cloudinaryConfigured, env } from './config/env.js';
import app from './app.js';
import { startReminderCron } from './jobs/reminders.js';
import { verifyEmailTransport } from './utils/email.js';

// Local / long-running server. On Vercel the app is served via api/index.ts.
app.listen(env.PORT, async () => {
  console.log(`\n🚀 Officer App Server → http://localhost:${env.PORT}/api`);

  // Make the active integrations obvious at boot — silently falling back to a
  // different backend than intended is hard to spot from the outside.
  console.log(
    `   uploads : ${cloudinaryConfigured ? `cloudinary (${env.CLOUDINARY_CLOUD_NAME})` : 'local disk → ./uploads'}`,
  );
  console.log(
    `   email   : ${env.EMAIL_MODE === 'smtp' ? `smtp ${env.SMTP_HOST}:${env.SMTP_PORT ?? 587}` : 'stub (console only)'}`,
  );
  console.log(`   model   : ${env.PY_SERVICE_URL}\n`);

  if (env.EMAIL_MODE === 'smtp') {
    const result = await verifyEmailTransport();
    console.log(
      result.ok
        ? '   ✓ SMTP connection verified\n'
        : `   ✗ SMTP verification FAILED: ${result.error}\n`,
    );
  }

  startReminderCron();
});

export default app;
