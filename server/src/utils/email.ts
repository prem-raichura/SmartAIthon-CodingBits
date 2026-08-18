import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const FROM =
  env.EMAIL_MODE === 'smtp'
    ? env.SMTP_FROM
    : '"Officer App" <noreply@officerapp.local>';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (env.EMAIL_MODE === 'smtp') {
    const port = env.SMTP_PORT ?? 587;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      // 465 is implicit TLS; 587/25 start plaintext and upgrade via STARTTLS.
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      // Gmail throttles aggressively on burst sends (e.g. the reminder job).
      pool: true,
      maxConnections: 3,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });
  } else {
    // jsonTransport never opens a socket, so stub mode works fully offline.
    // (The previous Ethereal test account required network on every boot and
    // stalled the reminder job when unreachable.)
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

/** Probes the SMTP connection so a bad host/password is reported at boot
 *  instead of silently failing on the first approval email. */
export async function verifyEmailTransport(): Promise<{ ok: boolean; error?: string }> {
  if (env.EMAIL_MODE !== 'smtp') return { ok: true };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function logStub(lines: string[]) {
  if (env.EMAIL_MODE !== 'stub') return;
  console.log(`\n[EMAIL STUB] ─────────────────────────────`);
  for (const line of lines) console.log(`  ${line}`);
  console.log(`───────────────────────────────────────────\n`);
}

/** Sends and logs the outcome. In smtp mode a silent send is indistinguishable
 *  from a silent failure, so always print what the server accepted/rejected. */
async function deliver(to: string, subject: string, text: string): Promise<void> {
  try {
    const info = await getTransporter().sendMail({ from: FROM, to, subject, text });
    if (env.EMAIL_MODE === 'smtp') {
      const accepted = (info.accepted ?? []).join(', ') || 'none';
      const rejected = (info.rejected ?? []).join(', ');
      console.log(
        `[email] sent "${subject}" → accepted: ${accepted}` +
          (rejected ? ` | REJECTED: ${rejected}` : '') +
          ` | id: ${info.messageId ?? '—'}`,
      );
    }
  } catch (e) {
    console.error(
      `[email] FAILED "${subject}" → ${to}: ${e instanceof Error ? e.message : String(e)}`,
    );
    throw e;
  }
}

export async function sendEmail(to: string, subject: string, text: string) {
  await deliver(to, subject, text);
  logStub([
    `To:      ${to}`,
    `Subject: ${subject}`,
    `Body:    ${text.replace(/\n/g, ' / ')}`,
  ]);
}

export async function sendCredentials(to: string, username: string, password: string) {
  await deliver(
    to,
    'Your Officer App login credentials',
    [
      'Your registration has been approved.',
      '',
      `Username: ${username}`,
      `Password: ${password}`,
      '',
      'Please change your password after first login.',
    ].join('\n'),
  );

  logStub([`To:       ${to}`, `Username: ${username}`, `Password: ${password}`]);
}
