import { z } from 'zod';

/** Mongo ObjectId-shaped string (24 hex chars). */
export const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/** Cursor pagination input shared across list endpoints. */
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

/** Generic empty-object input (for POST endpoints that take no body). */
export const emptySchema = z.object({}).strict();
