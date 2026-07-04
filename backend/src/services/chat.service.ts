/**
 * Chat service — loan-scoped messaging.
 *
 * Permission: only the loan's borrower or lender can read or write.
 * Real-time delivery: after persisting a message, the service emits a
 * 'message:new' event on the Socket.io /realtime namespace into both
 * participants' personal rooms. The room-fanout helper is injected at
 * boot via `setRealtimeEmitter` so the service stays unit-testable.
 */
import { Types } from 'mongoose';
import type { MessageKind, MessageQuery, SendMessageInput } from 'trustpe-shared';
import { Message, type MessageDocument } from '../models/Message.js';
import { Loan } from '../models/Loan.js';
import { AppError } from '../middleware/error-handler.js';

export type MessagePayload = {
  id: string;
  loanId: string;
  senderId: string | null;
  senderRole: 'borrower' | 'lender' | 'system';
  kind: MessageKind;
  content: string;
  metadata: unknown;
  createdAt: string;
};

function toPayload(m: MessageDocument): MessagePayload {
  return {
    id: String(m._id),
    loanId: String(m.loanId),
    senderId: m.senderId ? String(m.senderId) : null,
    senderRole: m.senderRole,
    kind: m.kind,
    content: m.content,
    metadata: m.metadata,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * Pluggable emitter for real-time message broadcasts. Set at server boot
 * by socket/index.ts. Default no-op so unit tests don't need a socket
 * server.
 */
type Emit = (
  recipientIds: string[],
  event: 'message:new',
  payload: MessagePayload,
) => void;
let emit: Emit = () => {};
export function setRealtimeEmitter(fn: Emit) {
  emit = fn;
}

/** Asserts the viewer is borrower or lender on the loan. Returns the loan doc. */
async function assertLoanParty(loanId: string, viewerId: string) {
  if (!Types.ObjectId.isValid(loanId)) {
    throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
  }
  const loan = await Loan.findById(loanId);
  if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);
  if (String(loan.borrowerId) !== viewerId && String(loan.lenderId) !== viewerId) {
    throw new AppError('forbidden', 'You are not a party to this loan.', 403);
  }
  return loan;
}

export const chatService = {
  /** Paginated message history (newest first, cursor by createdAt). */
  async list(loanId: string, viewerId: string, query: MessageQuery): Promise<MessagePayload[]> {
    await assertLoanParty(loanId, viewerId);
    const filter: Record<string, unknown> = { loanId: new Types.ObjectId(loanId) };
    if (query.before) filter.createdAt = { $lt: query.before };
    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(query.limit);
    return messages.map(toPayload);
  },

  /** Send a text message and broadcast to both participants. */
  async send(loanId: string, senderId: string, input: SendMessageInput): Promise<MessagePayload> {
    const loan = await assertLoanParty(loanId, senderId);
    const senderRole: 'borrower' | 'lender' =
      String(loan.borrowerId) === senderId ? 'borrower' : 'lender';

    const [msg] = await Message.create([
      {
        loanId: loan._id,
        senderId,
        senderRole,
        kind: 'text',
        content: input.content,
        createdAt: new Date(),
      },
    ]);
    if (!msg) throw new AppError('create_failed', 'Failed to send message', 500);
    const payload = toPayload(msg);

    // Real-time fanout to both parties (sender included so other devices the
    // sender has open also see the message immediately).
    emit([String(loan.borrowerId), String(loan.lenderId)], 'message:new', payload);
    return payload;
  },

  /**
   * Append a system message (no human sender). Used by later sprints —
   * payment events, agreement signing, etc. — to drop structured events
   * into the conversation.
   */
  async postSystem(
    loanId: string,
    kind: MessageKind,
    content: string,
    metadata: unknown = null,
  ): Promise<MessagePayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const loan = await Loan.findById(loanId);
    if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);

    const [msg] = await Message.create([
      {
        loanId: loan._id,
        senderId: null,
        senderRole: 'system',
        kind,
        content,
        metadata,
        createdAt: new Date(),
      },
    ]);
    if (!msg) throw new AppError('create_failed', 'Failed to post system message', 500);
    const payload = toPayload(msg);
    emit([String(loan.borrowerId), String(loan.lenderId)], 'message:new', payload);
    return payload;
  },
};
