/**
 * Dashboard routes (Lab 4, Issue 5).
 * api-spec.md §5, §7; specification.md FR-13, FR-14, BR-26.
 *
 * Role gates are applied per route (never router-wide, Lab 3 lesson): the
 * requester dashboard is REQUESTER-only, the staff dashboard is
 * IT_STAFF/ADMINISTRATOR-only. No endpoint accepts a user identifier — the
 * scope always comes from the authenticated session (BR-26).
 */
import { Router } from 'express';
import {
  errorResponse,
  requireAuth,
  requirePasswordChangeComplete,
  requireRole,
  type AuthenticatedRequest
} from '../auth.js';
import { buildRequesterDashboard, buildStaffDashboard } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/requester',
  requireAuth,
  requirePasswordChangeComplete,
  requireRole('REQUESTER'),
  async (req, res) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        errorResponse(res, 401, 'UNAUTHENTICATED', 'Authentication is required.');
        return;
      }
      const dashboard = await buildRequesterDashboard(user.id);
      res.status(200).json(dashboard);
    } catch {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load the requester dashboard.');
    }
  }
);

dashboardRouter.get(
  '/staff',
  requireAuth,
  requirePasswordChangeComplete,
  requireRole('IT_STAFF', 'ADMINISTRATOR'),
  async (req, res) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        errorResponse(res, 401, 'UNAUTHENTICATED', 'Authentication is required.');
        return;
      }
      const dashboard = await buildStaffDashboard(user.id, user.role === 'ADMINISTRATOR');
      res.status(200).json(dashboard);
    } catch {
      errorResponse(res, 500, 'INTERNAL_ERROR', 'Unable to load the staff dashboard.');
    }
  }
);
