/**
 * EMI service — schedule generation + paid marker.
 *
 * Generation is idempotent: re-running for the same loan returns the
 * existing schedule. Generation runs in `payment.service.ts` immediately
 * after a disbursal is verified.
 */
import { Types, type ClientSession } from 'mongoose';
import { EmiSchedule, type EmiScheduleDocument } from '../models/EmiSchedule.js';
import { Loan, type LoanDocument } from '../models/Loan.js';
import { AppError } from '../middleware/error-handler.js';

export type EmiInstallmentPayload = {
  emiNumber: number;
  dueDate: string;
  principalPaise: number;
  interestPaise: number;
  amountPaise: number;
  status: 'pending' | 'paid' | 'overdue';
  paidPaymentIntentId?: string;
  paidAt?: string;
};

export type EmiSchedulePayload = {
  id: string;
  loanId: string;
  totalMonths: number;
  startDate: string;
  monthlyAmountPaise: number;
  totalInterestPaise: number;
  installments: EmiInstallmentPayload[];
};

function toPayload(s: EmiScheduleDocument): EmiSchedulePayload {
  return {
    id: String(s._id),
    loanId: String(s.loanId),
    totalMonths: s.totalMonths,
    startDate: s.startDate.toISOString(),
    monthlyAmountPaise: s.monthlyAmountPaise,
    totalInterestPaise: s.totalInterestPaise,
    installments: s.installments.map((i) => ({
      emiNumber: i.emiNumber,
      dueDate: i.dueDate.toISOString(),
      principalPaise: i.principalPaise,
      interestPaise: i.interestPaise,
      amountPaise: i.amountPaise,
      status: i.status,
      paidPaymentIntentId: i.paidPaymentIntentId ? String(i.paidPaymentIntentId) : undefined,
      paidAt: i.paidAt?.toISOString(),
    })),
  };
}

/** Returns startDate + N months, preserving day-of-month where possible. */
function addMonths(start: Date, months: number): Date {
  const d = new Date(start);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // Handle Feb 30 / Apr 31 — Date constructor wraps, so cap to last day of intended month
  if (d.getMonth() !== ((start.getMonth() + months) % 12 + 12) % 12) {
    d.setDate(0); // last day of previous (intended) month
  }
  return d;
}

export const emiService = {
  /**
   * Generate an EMI schedule for a freshly-disbursed loan. Idempotent —
   * returns the existing schedule if one already exists.
   */
  async generateForLoan(
    loan: LoanDocument,
    disbursedAt: Date,
    session?: ClientSession,
  ): Promise<EmiScheduleDocument> {
    const existing = await EmiSchedule.findOne({ loanId: loan._id }).session(session ?? null);
    if (existing) return existing;

    const tenure = loan.tenureMonths;
    const principal = loan.amountPaise;
    const totalInterest = Math.round((principal * loan.roiPercent * tenure) / (100 * 12));
    const totalAmount = principal + totalInterest;
    const monthly = Math.round(totalAmount / tenure);

    // Equal principal + equal interest per EMI (simple-interest model).
    // Floor the per-EMI portions and let the LAST installment absorb every
    // rounding remainder, so the schedule sums EXACTLY to principal +
    // totalInterest and each row satisfies amount = principal + interest.
    const principalPerEmi = Math.floor(principal / tenure);
    const interestPerEmi = Math.floor(totalInterest / tenure);

    const installments = [];
    for (let i = 1; i <= tenure; i++) {
      const isLast = i === tenure;
      const principalPaise = isLast
        ? principal - principalPerEmi * (tenure - 1)
        : principalPerEmi;
      const interestPaise = isLast
        ? totalInterest - interestPerEmi * (tenure - 1)
        : interestPerEmi;
      installments.push({
        emiNumber: i,
        dueDate: addMonths(disbursedAt, i),
        principalPaise,
        interestPaise,
        amountPaise: principalPaise + interestPaise,
        status: 'pending' as const,
      });
    }

    const created = await EmiSchedule.create(
      [
        {
          loanId: loan._id,
          totalMonths: tenure,
          startDate: disbursedAt,
          monthlyAmountPaise: monthly,
          totalInterestPaise: totalInterest,
          installments,
        },
      ],
      session ? { session } : {},
    );
    if (!created[0]) throw new AppError('create_failed', 'Failed to generate EMI schedule', 500);
    return created[0];
  },

  /** Returns the loan's schedule; throws if absent (caller is borrower or lender). */
  async getForLoan(loanId: string, viewerId: string): Promise<EmiSchedulePayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const loan = await Loan.findById(loanId);
    if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);
    if (String(loan.borrowerId) !== viewerId && String(loan.lenderId) !== viewerId) {
      throw new AppError('forbidden', 'Not your loan.', 403);
    }
    const schedule = await EmiSchedule.findOne({ loanId });
    if (!schedule) {
      throw new AppError(
        'schedule_not_generated',
        'EMI schedule is generated when the loan is disbursed.',
        404,
      );
    }
    return toPayload(schedule);
  },

  /** Mark a single installment as paid. Called from payment.service. */
  async markEmiPaid(
    loanId: Types.ObjectId,
    emiNumber: number,
    paymentIntentId: Types.ObjectId,
    paidAt: Date,
    session?: ClientSession,
  ): Promise<EmiScheduleDocument> {
    const schedule = await EmiSchedule.findOne({ loanId }).session(session ?? null);
    if (!schedule) {
      throw new AppError('schedule_not_generated', 'EMI schedule missing for this loan', 500);
    }
    const installment = schedule.installments.find((i) => i.emiNumber === emiNumber);
    if (!installment) {
      throw new AppError('emi_not_found', `EMI #${emiNumber} not found on schedule`, 404);
    }
    if (installment.status === 'paid') {
      // Already settled (e.g. a disputed intent verified by admin after a
      // retry intent was also verified). Never overwrite the original
      // settlement pointer.
      return schedule;
    }
    installment.status = 'paid';
    installment.paidPaymentIntentId = paymentIntentId;
    installment.paidAt = paidAt;
    await schedule.save({ session });
    return schedule;
  },
};
