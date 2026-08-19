import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { sendEmail } from '../utils/email.js';
import { sendPush } from '../utils/push.js';

/**
 * Find active assignments whose time_limit has lapsed without a submitted report,
 * and that have not already been reminded, then nudge the officer by mail + push.
 * Returns the number of reminders sent.
 *
 * Safe to run twice. Vercel Cron delivery is best-effort: a scheduled run can be
 * missed, and the same run can occasionally be invoked more than once. Each
 * assignment is therefore *claimed* inside a transaction — the notification row
 * doubles as the dedupe marker — before any email or push goes out, so a
 * duplicate invocation cannot send the same officer two reminders.
 */
export async function runReminders(): Promise<number> {
  const now = new Date();
  // "Already reminded" is filtered in the query rather than in JS, so the job
  // never loads assignments it is going to skip.
  const overdue = await prisma.assignment.findMany({
    where: {
      status: 'active',
      time_limit: { lt: now },
      validation: { is: null },
      notifications: { none: { type: 'reminder' } },
    },
    include: {
      user: { select: { id: true, name: true, email: true, push_token: true } },
      cell: { select: { h3_index: true } },
    },
  });

  let sent = 0;
  for (const a of overdue) {
    const zone = a.cell.h3_index;

    // Claim this assignment. The re-check runs inside the transaction so two
    // overlapping invocations cannot both win the same row. The notification is
    // itself the in-app delivery, so recording it first loses nothing if the
    // email later fails — that failure is logged by utils/email.
    const claimed = await prisma.$transaction(async (tx) => {
      const already = await tx.notification.count({
        where: { assignment_id: a.id, type: 'reminder' },
      });
      if (already > 0) return false;

      await tx.notification.create({
        data: {
          user_id: a.user_id,
          assignment_id: a.id,
          type: 'reminder',
          title: 'Patrol report overdue',
          body: `Your assigned time for zone ${zone} has ended. Please submit your field report now.`,
        },
      });
      return true;
    });

    if (!claimed) continue; // another invocation got there first

    await sendEmail(
      a.user.email,
      'Patrol report overdue',
      [
        `Hello ${a.user.name},`,
        '',
        `Your assigned patrol time for zone ${zone} has ended and no report has been submitted.`,
        'Please open the Officer App and submit your field report immediately.',
      ].join('\n'),
    ).catch((e) => console.error('[reminders] email failed:', e));

    await sendPush(a.user.push_token, 'Patrol report overdue', `Submit your report for zone ${zone}.`, {
      assignment_id: a.id,
    }).catch((e) => console.error('[reminders] push failed:', e));

    sent++;
  }

  console.log(`[reminders] swept ${overdue.length} overdue assignment(s), sent ${sent} reminder(s).`);
  return sent;
}

export function startReminderCron() {
  // On a serverless host this is never called (only src/index.ts calls it) —
  // there the sweep is driven by Vercel Cron, see server/vercel.json.
  // Set REMINDER_CRON=off to silence the in-process scheduler and rely purely
  // on an external scheduler hitting POST /api/jobs/reminders/run.
  const spec = env.REMINDER_CRON.trim();
  if (spec === 'off' || spec === 'false' || spec === 'disabled') {
    console.log('[reminders] in-process scheduler disabled (REMINDER_CRON=off).');
    return;
  }
  if (!cron.validate(spec)) {
    console.warn(`[reminders] invalid REMINDER_CRON "${spec}", skipping scheduler.`);
    return;
  }
  cron.schedule(spec, () => {
    runReminders().catch((e) => console.error('[reminders] run failed:', e));
  });
  console.log(`[reminders] scheduled (${spec}).`);
}
