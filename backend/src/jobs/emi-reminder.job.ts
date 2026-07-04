/**
 * EMI reminder cron.
 *
 * Phase 1 doesn't ship Redis or BullMQ, so this is a vanilla setInterval
 * driven by the backend process. Runs on boot then every 6 hours. Each
 * pass:
 *
 *   1. Loads every pending installment on every active loan
 *   2. Computes days-to-due for each
 *   3. Fires notifications at -3d / -1d / due / +1d-overdue / +7d-overdue / +14d-overdue
 *   4. Marks `reminderSentKinds` on the installment so re-runs and
 *      restarts don't re-send
 *
 * Notifications go to both borrower (you owe) and lender (heads up an EMI
 * is coming or overdue), with role-specific copy.
 */
import { EmiSchedule } from '../models/EmiSchedule.js';
import { Loan } from '../models/Loan.js';
import { notificationService } from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

type ReminderKind = 'due_3d' | 'due_1d' | 'due_today' | 'overdue_1d' | 'overdue_7d' | 'overdue_14d';

function pickReminders(daysToDue: number): ReminderKind[] {
  const out: ReminderKind[] = [];
  if (daysToDue === 3) out.push('due_3d');
  if (daysToDue === 1) out.push('due_1d');
  if (daysToDue === 0) out.push('due_today');
  if (daysToDue === -1) out.push('overdue_1d');
  if (daysToDue === -7) out.push('overdue_7d');
  if (daysToDue === -14) out.push('overdue_14d');
  return out;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

async function runOnce(): Promise<void> {
  // Full docs in one query — the loop below needs snapshots, and re-fetching
  // each loan per schedule was an N+1.
  const activeLoans = await Loan.find({ status: 'active' });
  if (activeLoans.length === 0) return;
  const loanById = new Map(activeLoans.map((l) => [String(l._id), l]));

  const schedules = await EmiSchedule.find({ loanId: { $in: activeLoans.map((l) => l._id) } });
  if (schedules.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalise to midnight so daysToDue is whole

  let notifiedCount = 0;
  for (const schedule of schedules) {
    const loan = loanById.get(String(schedule.loanId));
    if (!loan) continue;

    let mutated = false;
    for (const installment of schedule.installments) {
      if (installment.status === 'paid') continue;

      const dueDate = new Date(installment.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysToDue = Math.round((dueDate.getTime() - today.getTime()) / MS_PER_DAY);

      const targets = pickReminders(daysToDue);
      if (targets.length === 0) continue;

      const already = (installment.reminderSentKinds as string[]) ?? [];

      for (const kind of targets) {
        if (already.includes(kind)) continue;

        const amountStr = formatRupees(installment.amountPaise);
        const emiLabel = `EMI #${installment.emiNumber}`;
        const isOverdue = kind.startsWith('overdue');

        // Borrower-facing copy
        let borrowerTitle = '';
        let borrowerBody = '';
        if (kind === 'due_3d') {
          borrowerTitle = `📅 ${emiLabel} due in 3 days`;
          borrowerBody = `${amountStr} to ${loan.lenderSnapshot.name} on ${dueDate.toLocaleDateString()}. Get UPI ready.`;
        } else if (kind === 'due_1d') {
          borrowerTitle = `📅 ${emiLabel} due tomorrow`;
          borrowerBody = `${amountStr} to ${loan.lenderSnapshot.name}. Tap to pay now.`;
        } else if (kind === 'due_today') {
          borrowerTitle = `⏰ ${emiLabel} due today`;
          borrowerBody = `Pay ${amountStr} to ${loan.lenderSnapshot.name} before end of day.`;
        } else if (kind === 'overdue_1d') {
          borrowerTitle = `⚠️ ${emiLabel} is overdue`;
          borrowerBody = `${amountStr} was due yesterday. Pay now to keep your TrustScore safe.`;
        } else if (kind === 'overdue_7d') {
          borrowerTitle = `⚠️ ${emiLabel} overdue 1 week`;
          borrowerBody = `${amountStr} is 7 days overdue. Disputes after 15 days hurt TrustScore.`;
        } else if (kind === 'overdue_14d') {
          borrowerTitle = `🚨 ${emiLabel} overdue 2 weeks`;
          borrowerBody = `${amountStr} is 14 days overdue. ${loan.lenderSnapshot.name} may escalate to admin.`;
        }

        await notificationService.notify(
          String(loan.borrowerId),
          isOverdue ? 'emi_overdue' : 'emi_due',
          borrowerTitle,
          borrowerBody,
          {
            deepLink: `/loans/${loan._id}`,
            metadata: {
              loanId: String(loan._id),
              emiNumber: installment.emiNumber,
              reminderKind: kind,
            },
          },
        );

        // Lender-facing copy on due-day + overdue only (less noisy)
        if (kind === 'due_today' || isOverdue) {
          const lenderTitle = isOverdue
            ? `⚠️ ${emiLabel} from ${loan.borrowerSnapshot.name} overdue`
            : `📅 ${emiLabel} from ${loan.borrowerSnapshot.name} due today`;
          const lenderBody = isOverdue
            ? `${amountStr} was due ${Math.abs(daysToDue)} day${Math.abs(daysToDue) > 1 ? 's' : ''} ago. We'll keep nudging the borrower.`
            : `${amountStr}. We'll let you know once they confirm payment.`;
          await notificationService.notify(
            String(loan.lenderId),
            isOverdue ? 'emi_overdue' : 'emi_due',
            lenderTitle,
            lenderBody,
            {
              deepLink: `/loans/${loan._id}`,
              metadata: {
                loanId: String(loan._id),
                emiNumber: installment.emiNumber,
                reminderKind: kind,
              },
            },
          );
        }

        installment.reminderSentKinds = [...already, kind];
        already.push(kind);
        mutated = true;
        notifiedCount++;
      }
    }

    if (mutated) {
      try {
        await schedule.save();
      } catch (err) {
        logger.warn({ err, scheduleId: schedule._id }, '[emi-reminder] save failed');
      }
    }
  }

  if (notifiedCount > 0) {
    logger.info({ notifiedCount }, '[emi-reminder] sent reminders');
  }
}

export function startEmiReminderJob(): { stop: () => void } {
  // Run on boot (don't block boot — fire-and-forget)
  void runOnce().catch((err) => logger.warn({ err }, '[emi-reminder] first run failed'));

  const interval = setInterval(() => {
    void runOnce().catch((err) => logger.warn({ err }, '[emi-reminder] run failed'));
  }, SIX_HOURS_MS);

  return { stop: () => clearInterval(interval) };
}
