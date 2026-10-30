export type ActionTakenDto = {
  id: number;
  ticketId: number;
  actionAt: string;
  description: string;
  result: string;
  performedBy: { id: number; name: string };
  followUpRequired: boolean;
  followUpNote: string | null;
  followUpCompletedAt: string | null;
  attachmentNotes: string | null;
  version: number;
  updatedBy: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
};

export type ActionsTakenListResponse = {
  actionsTaken: ActionTakenDto[];
  summary: { total: number; openFollowUps: number };
};

export type CreateActionTakenPayload = {
  actionAt?: string;
  description: string;
  result: string;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  clientRequestId: string;
};

export type UpdateActionTakenPayload = {
  expectedVersion: number;
  actionAt?: string;
  description?: string;
  result?: string;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  followUpCompleted?: boolean;
};

export type ActionTakenBody = { actionTaken: ActionTakenDto };

export class ActionsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;

  constructor(message: string, status: number, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ActionsApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type ErrorEnvelope = {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const body = (await response.json().catch(() => ({}))) as T & ErrorEnvelope;
  if (!response.ok) {
    throw new ActionsApiError(
      body.error?.message ?? 'Request failed.',
      response.status,
      body.error?.code,
      body.error?.fields
    );
  }
  return body;
}

const jsonHeaders = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

export async function listActionsTaken(ticketId: number): Promise<ActionsTakenListResponse> {
  const body = await request<Partial<ActionsTakenListResponse>>(`/api/tickets/${ticketId}/actions-taken`);
  return {
    actionsTaken: Array.isArray(body.actionsTaken) ? body.actionsTaken : [],
    summary: body.summary ?? { total: 0, openFollowUps: 0 }
  };
}

export async function createActionTaken(ticketId: number, payload: CreateActionTakenPayload): Promise<ActionTakenDto> {
  const body = await request<ActionTakenBody>(`/api/staff/tickets/${ticketId}/actions-taken`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
  return body.actionTaken;
}

export async function updateActionTaken(
  ticketId: number,
  actionId: number,
  payload: UpdateActionTakenPayload
): Promise<ActionTakenDto> {
  const body = await request<ActionTakenBody>(`/api/staff/tickets/${ticketId}/actions-taken/${actionId}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });
  return body.actionTaken;
}

export function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
