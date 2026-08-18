import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';

export async function generate(monthStr: string, modelVersion: string) {
  // Parse the month explicitly and build the window in UTC. `new Date('2024-05-01')`
  // is UTC midnight, so the old setDate/setHours calls (which are local-time)
  // shifted the boundary into the previous month for positive UTC offsets.
  const match = /^(\d{4})-(\d{2})/.exec(monthStr);
  if (!match) throw new AppError(400, 'Invalid month format (expected YYYY-MM)');

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new AppError(400, 'Invalid month format (expected YYYY-MM)');

  const monthDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  if (isNaN(monthDate.getTime())) throw new AppError(400, 'Invalid month format');

  const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  const validations = await prisma.fieldValidation.findMany({
    where: { submitted_at: { gte: monthDate, lt: nextMonth } },
    include: {
      cell: { select: { predicted_violations: true, risk_level: true } },
    },
  });

  let tp = 0, fp = 0, fn = 0;
  for (const v of validations) {
    const predictedCongestion =
      (v.cell.predicted_violations ?? 0) > 0 ||
      ['high', 'critical'].includes(v.cell.risk_level);
    if (predictedCongestion && v.has_congestion) tp++;
    else if (predictedCongestion && !v.has_congestion) fp++;
    else if (!predictedCongestion && v.has_congestion) fn++;
  }

  const total = validations.length;
  const accuracy = total > 0 ? tp / total : 0;

  return prisma.modelFeedbackBatch.upsert({
    where: { month: monthDate },
    create: {
      month: monthDate,
      model_version: modelVersion,
      total_validations: total,
      true_positives: tp,
      false_positives: fp,
      false_negatives: fn,
      accuracy_score: Math.round(accuracy * 10000) / 10000,
    },
    update: {
      model_version: modelVersion,
      total_validations: total,
      true_positives: tp,
      false_positives: fp,
      false_negatives: fn,
      accuracy_score: Math.round(accuracy * 10000) / 10000,
    },
  });
}

export async function list() {
  return prisma.modelFeedbackBatch.findMany({ orderBy: { month: 'desc' } });
}

export async function submit(batchId: string) {
  const batch = await prisma.modelFeedbackBatch.findUnique({ where: { batch_id: batchId } });
  if (!batch) throw new AppError(404, 'Batch not found');
  if (batch.status === 'submitted') throw new AppError(400, 'Already submitted');
  return prisma.modelFeedbackBatch.update({
    where: { batch_id: batchId },
    data: { status: 'submitted', submitted_at: new Date() },
  });
}
