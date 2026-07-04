import type { Request, Response, NextFunction } from 'express';
import type {
  InitiateEmiPaymentInput,
  PayerEvidenceInput,
  PayerFailureInput,
  ReceiverAttestationInput,
} from 'trustpe-shared';
import { paymentService } from '../services/payment.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const paymentController = {
  // POST /v1/loans/:loanId/disburse
  async disburse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const intent = await paymentService.initiateDisbursal(
        req.user.id,
        loanId,
        ctxFromRequest(req, 'user'),
      );
      res.status(201).json({ ok: true, data: intent });
    } catch (err) {
      next(err);
    }
  },

  // POST /v1/loans/:loanId/emi-payments
  async initiateEmi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      // Routes always run validateBody() before this handler.
      const body = req.validated?.body as InitiateEmiPaymentInput;
      const intent = await paymentService.initiateEmiPayment(
        req.user.id,
        loanId,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.status(201).json({ ok: true, data: intent });
    } catch (err) {
      next(err);
    }
  },

  // GET /v1/loans/:loanId/payments
  async listForLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const items = await paymentService.listForLoan(loanId, req.user.id);
      res.json({ ok: true, data: { items } });
    } catch (err) {
      next(err);
    }
  },

  // GET /v1/payments/:id
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Payment id is required', 400);
      const intent = await paymentService.getOne(id, req.user.id);
      res.json({ ok: true, data: intent });
    } catch (err) {
      next(err);
    }
  },

  // POST /v1/payments/:id/payer-evidence
  async payerEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Payment id is required', 400);
      const body = req.validated?.body as PayerEvidenceInput;
      const intent = await paymentService.submitPayerEvidence(
        id,
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.json({ ok: true, data: intent });
    } catch (err) {
      next(err);
    }
  },

  // POST /v1/payments/:id/payer-failure
  async payerFailure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Payment id is required', 400);
      const body = req.validated?.body as PayerFailureInput;
      const intent = await paymentService.submitPayerFailure(
        id,
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.json({ ok: true, data: intent });
    } catch (err) {
      next(err);
    }
  },

  // POST /v1/payments/:id/attestation
  async attestation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Payment id is required', 400);
      const body = req.validated?.body as ReceiverAttestationInput;
      const intent = await paymentService.submitAttestation(
        id,
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.json({ ok: true, data: intent });
    } catch (err) {
      next(err);
    }
  },
};
