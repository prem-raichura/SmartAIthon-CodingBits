import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';

export async function listMine(userId: string) {
  return prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { sent_at: 'desc' },
  });
}

export async function markRead(notificationId: string, userId: string) {
  const n = await prisma.notification.findUnique({ where: { notification_id: notificationId } });
  if (!n) throw new AppError(404, 'Notification not found');
  if (n.user_id !== userId) throw new AppError(403, 'Forbidden');
  return prisma.notification.update({
    where: { notification_id: notificationId },
    data: { is_read: true },
  });
}
