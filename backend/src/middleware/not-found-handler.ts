import type { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'route_not_found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
};
