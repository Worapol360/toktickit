# Lab 4 API Specification

Companion files: [`specification.md`](./specification.md) · [`ui-spec.md`](./ui-spec.md) · [`tests.md`](./tests.md)

This document extends `docs/lab-03/api-spec.md`. Everything not mentioned here keeps its Lab 2/3 contract.

## 1. Conventions

- Base URL `/api`; JSON; dates are ISO 8601 UTC strings.
- Authentication, cookie, CSRF header (`X-Requested-With: XMLHttpRequest` on `POST`/`PATCH`/`DELETE`), `mustChangePassword` gate, and the `404`-instead-of-`403` rule for other users' Tickets are unchanged from Lab 3.
- Error envelope is unchanged. Lab 4 adds an optional `details` object, used only by `VERSION_CONFLICT` and `RESOLUTION_BLOCKED`:

```json
{
  "error": {
    "code": "RESOLUTION_BLOCKED",
    "message": "Ticket cannot be resolved yet.",
    "details": { "reason": "OPEN_FOLLOW_UPS", "openFollowUps": 2 }
  }
}
```

- `performedById`, `requesterId`, `updatedById`, `version` (on create), and `clientRequestId` are never trusted as identity: identity always comes from the session.
- Role gates are applied **per route**, not per router (Lab 3 lesson). New shared endpoints have their own gate.

### 1.1 New error codes

| Code | Status | Meaning |
|---|---:|---|
| `VERSION_CONFLICT` | 409 | `expectedVersion` differs from the stored `version`. `details.currentVersion` is returned. |
| `RESOLUTION_BLOCKED` | 409 | `→ Resolved` refused by the resolution gate (BR-15). `details.reason` is `NO_ACTIONS_TAKEN` or `OPEN_FOLLOW_UPS` (with `openFollowUps`). |
| `TICKET_ACTIONS_LOCKED` | 409 | Action create/update attempted while the Ticket is `Resolved`, `Closed`, or `Cancelled` (BR-10). |
| `ACTION_NOT_FOUND` | 404 | Action does not exist on that Ticket. |
| `INVALID_ACTION_ID` | 400 | `actionId` is not a positive integer. |

Existing codes reused: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `CSRF_CHECK_FAILED` 403, `TICKET_NOT_FOUND` 404, `INVALID_TICKET_ID` 400, `VALIDATION_ERROR` 400, `INVALID_QUERY_PARAMETER` 400, `INVALID_STATUS_TRANSITION` 409, `TICKET_ALREADY_CLOSED` 409, `INTERNAL_ERROR` 500.

## 2. Shared resource shapes

### 2.1 Ticket (extended)

Adds `version` and `resolvedAt` to the Lab 3 shape. Staff-scoped responses also include `allowedTransitions`; it is structurally absent from Requester-scoped responses.

```json
{
  "id": 101,
  "ticketNumber": "TICK-20261020-0001",
  "summary": "Cannot access shared drive",
  "status": "In Progress",
  "requestedPriority": "High",
  "itPriority": "High",
  "owner": { "id": 7, "name": "Priya Nair" },
  "requesterMarkedResolved": false,
  "version": 4,
  "resolvedAt": null,
  "updatedAt": "2026-10-21T09:30:00.000Z",
  "allowedTransitions": ["Waiting for Requester", "Resolved", "Cancelled"]
}
```

(Other Lab 3 fields — `description`, `requesterId`, `category`, `relatedSystem`, `attachments`, `createdAt` — are unchanged and omitted here.)

`allowedTransitions` is computed from the matrix in `specification.md` BR-13 for the Ticket's current status. It does **not** pre-evaluate the resolution gate.

### 2.2 ActionTaken

```json
{
  "id": 21,
  "ticketId": 101,
  "actionAt": "2026-10-21T08:45:00.000Z",
  "description": "Remapped the Finance share on the user's laptop.",
  "result": "Drive reachable after remap; waiting for user confirmation.",
  "performedBy": { "id": 8, "name": "Noah Lim" },
  "followUpRequired": true,
  "followUpNote": "Confirm with the user after restart tomorrow.",
  "followUpCompletedAt": null,
  "attachmentNotes": "See screenshot 'share-error.png' on the Ticket.",
  "version": 1,
  "updatedBy": { "id": 8, "name": "Noah Lim" },
  "createdAt": "2026-10-21T08:50:00.000Z",
  "updatedAt": "2026-10-21T08:50:00.000Z"
}
```

`followUpNote` and `followUpCompletedAt` are `null` when `followUpRequired = false`. `clientRequestId` is never returned. Requesters receive the same shape (BR-11).

### 2.3 TicketSummary (dashboard lists)

Requester-scoped: `{ id, ticketNumber, summary, status, updatedAt }` (`recentlyResolved` items add `resolvedAt`).
Staff-scoped: `{ id, ticketNumber, summary, status, itPriority, owner, requesterMarkedResolved, updatedAt }`.

### 2.4 Drilldown

`{ "path": "/staff/tickets", "query": { "ownerId": "unassigned", "statusGroup": "active" } }`, or `null` when the card has no destination. The backend defines it; the client only navigates to `path` + query string.

## 3. Actions Taken

### 3.1 List Actions of a Ticket

`GET /api/tickets/:id/actions-taken`

Roles: `REQUESTER` (owner of the Ticket only), `IT_STAFF`, `ADMINISTRATOR`. Readable in every Ticket status.

Success `200 OK`:

```json
{
  "actionsTaken": [ActionTaken],
  "summary": { "total": 3, "openFollowUps": 1 }
}
```

Ordered `createdAt ASC, id ASC` (BR-09). Returns `"actionsTaken": []` and `{ "total": 0, "openFollowUps": 0 }` for legacy Tickets. `summary` lets the UI show resolution readiness without a second call.

Errors: `400 INVALID_TICKET_ID`; `401 UNAUTHENTICATED`; `404 TICKET_NOT_FOUND` (missing, or Requester does not own it); `500 INTERNAL_ERROR`.

### 3.2 Create an Action Taken

`POST /api/staff/tickets/:id/actions-taken`

Roles: `IT_STAFF`, `ADMINISTRATOR`.

```json
{
  "actionAt": "2026-10-21T08:45:00.000Z",
  "description": "Remapped the Finance share on the user's laptop.",
  "result": "Drive reachable after remap; waiting for user confirmation.",
  "followUpRequired": true,
  "followUpNote": "Confirm with the user after restart tomorrow.",
  "attachmentNotes": "See screenshot 'share-error.png' on the Ticket.",
  "clientRequestId": "6f1c2a8e-6a0d-4a63-9d5b-2f6f3b7c0a11"
}
```

| Field | Required | Rule |
|---|:-:|---|
| `actionAt` | no | ISO 8601; default = server now; ≥ Ticket `createdAt`; ≤ server now + 5 min (BR-04). |
| `description` | yes | trimmed, 5–2000 chars. |
| `result` | yes | trimmed, 2–1000 chars. |
| `followUpRequired` | no | boolean, default `false`. |
| `followUpNote` | iff `followUpRequired` | trimmed 5–500 chars; discarded when `followUpRequired` is `false`. |
| `attachmentNotes` | no | trimmed, ≤ 500 chars. |
| `clientRequestId` | no | UUID string; idempotency key per Ticket (BR-23). |

Unknown fields (including `performedById`, `performedBy`, `version`, `followUpCompletedAt`) are ignored.

Success: `201 Created` → `{ "actionTaken": ActionTaken }` with `performedBy` = session user, `version` = 1, and the Ticket's `updatedAt` refreshed. If the same `(ticketId, clientRequestId)` already exists: `200 OK` with the existing Action (no new row).

Errors:

- `400 INVALID_TICKET_ID`
- `400 VALIDATION_ERROR` with `fields`, e.g. `{ "description": "Enter a description of 5–2000 characters.", "followUpNote": "Enter a follow-up note of 5–500 characters when follow-up is required.", "actionAt": "Action time cannot be in the future." }`
- `401 UNAUTHENTICATED`; `403 FORBIDDEN` (Requester); `403 CSRF_CHECK_FAILED`
- `404 TICKET_NOT_FOUND`
- `409 TICKET_ACTIONS_LOCKED`
- `500 INTERNAL_ERROR`

### 3.3 Update an Action Taken

`PATCH /api/staff/tickets/:id/actions-taken/:actionId`

Roles: `IT_STAFF`, `ADMINISTRATOR` (any staff member may edit any Action).

```json
{
  "expectedVersion": 1,
  "result": "Drive reachable; user confirmed access.",
  "followUpCompleted": true
}
```

| Field | Rule |
|---|---|
| `expectedVersion` | **required** positive integer. |
| `actionAt`, `description`, `result`, `followUpRequired`, `followUpNote`, `attachmentNotes` | optional; same rules as create; only supplied fields change. |
| `followUpCompleted` | optional boolean; `true` sets `followUpCompletedAt = now`, `false` clears it; allowed only when the resulting `followUpRequired` is `true`. |

Merge rules: after applying the patch the resulting record must satisfy BR-06. Switching `followUpRequired` to `false` clears `followUpNote` and `followUpCompletedAt`; switching it to `true` requires a valid `followUpNote`. `performedBy` is immutable; `updatedBy` becomes the session user; `version` increments; the Ticket's `updatedAt` is refreshed.

Success: `200 OK` → `{ "actionTaken": ActionTaken }`.

Check order: `400` ids → `404 TICKET_NOT_FOUND` → `404 ACTION_NOT_FOUND` → `400 VALIDATION_ERROR` (including missing `expectedVersion`) → `409 TICKET_ACTIONS_LOCKED` → `409 VERSION_CONFLICT`. The version comparison is repeated inside the transaction (BR-22).

Errors: `400 INVALID_TICKET_ID`, `400 INVALID_ACTION_ID`, `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `403 CSRF_CHECK_FAILED`, `404 TICKET_NOT_FOUND`, `404 ACTION_NOT_FOUND`, `409 TICKET_ACTIONS_LOCKED`, `409 VERSION_CONFLICT` (`details.currentVersion`), `500 INTERNAL_ERROR`.

### 3.4 Delete

No `DELETE` endpoint exists (BR-08). A `DELETE` request returns the framework's `404`, and tests assert the row remains.

## 4. Ticket workflow changes

### 4.1 Update status

`PATCH /api/staff/tickets/:id/status` (roles `IT_STAFF`, `ADMINISTRATOR`)

```json
{ "status": "Resolved", "expectedVersion": 4 }
```

`expectedVersion` is optional (BR-21). Check order: `400 INVALID_TICKET_ID` → `404 TICKET_NOT_FOUND` → `400 VALIDATION_ERROR` (status not one of the 8 values, or `expectedVersion` not a positive integer) → `409 VERSION_CONFLICT` (if supplied) → `409 INVALID_STATUS_TRANSITION` → `409 RESOLUTION_BLOCKED` (only for `→ Resolved`) → `200`.

Permitted transitions (BR-13):

| From | To |
|---|---|
| New | Open, Cancelled |
| Open | In Progress, Cancelled |
| In Progress | Waiting for Requester, Resolved*, Cancelled |
| Waiting for Requester | In Progress, Resolved*, Cancelled |
| Resolved | Closed, Reopened |
| Closed | Reopened |
| Reopened | In Progress, Cancelled |
| Cancelled | — |

\* gated by BR-15.

Side effects (one transaction, Ticket row locked, BR-22): `version += 1`; `→ Resolved` sets `resolvedAt = now`; `→ Reopened` clears `resolvedAt` and sets `requesterMarkedResolved = false`; `Resolved → Closed` keeps `resolvedAt`.

Success: `200 OK` → `{ "ticket": Ticket }` (staff shape, including the new `allowedTransitions`).

Errors: as listed above; `403 FORBIDDEN` for Requester; `401`; `403 CSRF_CHECK_FAILED`; `500 INTERNAL_ERROR`.

### 4.2 Owner and priority

`PATCH /api/staff/tickets/:id/owner` and `PATCH /api/staff/tickets/:id/priority` keep their Lab 3 request/response and validation (including "active IT Staff/Administrator" for `ownerId`). Lab 4 additions: optional `expectedVersion` in the body (`409 VERSION_CONFLICT` when stale) and `version += 1` on success. Both responses use the extended Ticket shape.

### 4.3 Requester "Problem Appears Resolved"

`POST /api/tickets/:id/mark-resolved` keeps its Lab 3 contract (including `409 TICKET_ALREADY_CLOSED` for `Closed`/`Cancelled`). It never changes `status`; it increments `version`. The flag resets on `→ Reopened` (BR-17).

### 4.4 Staff ticket detail

`GET /api/staff/tickets/:id` keeps `{ ticket, comments, notes }`; `ticket` uses the extended shape. Actions are fetched with §3.1 (D-14).

### 4.5 `statusGroup` filter (additive)

`GET /api/tickets` and `GET /api/staff/tickets` accept `statusGroup=active` (statuses `New`, `Open`, `In Progress`, `Waiting for Requester`, `Reopened`). An unknown value, or `statusGroup` together with `status`, returns `400 INVALID_QUERY_PARAMETER`. All other parameters are unchanged and combine with it (AND).

## 5. Dashboards

Both endpoints are `GET`, read-only, and return concise data (counts and at most 5 items per list), never whole Ticket collections. Definitions, empty behavior, and time rules are in `specification.md` §5.4 (BR-25 – BR-31). "Recent" = rolling last 7 × 24 h; timestamps are UTC ISO strings (UI shows `Asia/Bangkok`).

### 5.1 Requester dashboard

`GET /api/dashboard/requester` — role `REQUESTER` only (staff/admin get `403 FORBIDDEN`). No parameters; scope is the session user.

```json
{
  "generatedAt": "2026-10-28T03:00:00.000Z",
  "windowDays": 7,
  "metrics": {
    "openTickets":         { "label": "My Open Tickets",  "value": 3, "drilldown": { "path": "/", "query": { "statusGroup": "active" } } },
    "waitingForRequester": { "label": "Waiting for Me",   "value": 1, "drilldown": { "path": "/", "query": { "status": "Waiting for Requester" } } },
    "resolved":            { "label": "Resolved",         "value": 2, "drilldown": { "path": "/", "query": { "status": "Resolved" } } }
  },
  "needsAttention":   [TicketSummary],
  "recentlyUpdated":  [TicketSummary],
  "recentlyResolved": [TicketSummary]
}
```

With no Tickets: all `value` are `0` and all lists are `[]`.

### 5.2 IT Staff / Administrator dashboard

`GET /api/dashboard/staff` — roles `IT_STAFF`, `ADMINISTRATOR` (Requester gets `403 FORBIDDEN`). Not ownership-scoped.

```json
{
  "generatedAt": "2026-10-28T03:00:00.000Z",
  "windowDays": 7,
  "metrics": {
    "unassigned":      { "label": "Unassigned",        "value": 4, "drilldown": { "path": "/staff/tickets", "query": { "ownerId": "unassigned", "statusGroup": "active" } } },
    "myOwned":         { "label": "My Owned Tickets",  "value": 6, "drilldown": { "path": "/staff/tickets", "query": { "ownerId": "7", "statusGroup": "active" } } },
    "myOpenFollowUps": { "label": "My Open Follow-ups", "value": 2, "drilldown": null }
  },
  "byStatus": [
    { "status": "New", "value": 3, "drilldown": { "path": "/staff/tickets", "query": { "status": "New" } } }
  ],
  "byPriority": [
    { "priority": "Urgent", "value": 1, "drilldown": { "path": "/staff/tickets", "query": { "itPriority": "Urgent", "statusGroup": "active" } } },
    { "priority": "Unset",  "value": 0, "drilldown": null }
  ],
  "recentTickets": [TicketSummary],
  "myRecentActions": [
    { "id": 21, "ticketId": 101, "ticketNumber": "TICK-20261020-0001", "description": "Remapped the Finance share…", "followUpRequired": true, "followUpOpen": true, "createdAt": "2026-10-21T08:50:00.000Z" }
  ],
  "users": { "activeRequesters": 4, "activeItStaff": 3, "activeAdministrators": 1, "inactive": 2 }
}
```

- `byStatus` always contains all 8 statuses in the order New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled (zeros included).
- `byPriority` always contains `Low`, `Medium`, `High`, `Urgent`, `Unset` counts over Active Tickets (`itPriority = NULL` → `Unset`, no drilldown).
- `myRecentActions[].description` is truncated to 120 characters.
- `users` is **present only for `ADMINISTRATOR`** and absent (not `null`) for `IT_STAFF`; its drilldown is `/admin/users`.

### 5.3 Dashboard errors

`401 UNAUTHENTICATED`, `403 FORBIDDEN`, `500 INTERNAL_ERROR` (safe message, no internals). No dashboard endpoint accepts a user identifier.

## 6. Health

`GET /api/health` — public, no CSRF header (read-only).

- `200 OK` → `{ "status": "ok", "database": "up", "time": "2026-10-28T03:00:00.000Z" }`
- `503 Service Unavailable` → `{ "status": "degraded", "database": "down" }`

No connection strings, versions, stack traces, or file paths are returned.

## 7. Authorization matrix (new/changed endpoints)

| Endpoint | Anonymous | Requester (owner) | Requester (other) | IT Staff | Administrator |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /api/tickets/:id/actions-taken` | 401 | 200 | 404 | 200 | 200 |
| `POST …/actions-taken` | 401 | 403 | 403 | 201/200 | 201/200 |
| `PATCH …/actions-taken/:actionId` | 401 | 403 | 403 | 200 | 200 |
| `PATCH …/status`, `…/owner`, `…/priority` | 401 | 403 | 403 | 200 | 200 |
| `GET /api/dashboard/requester` | 401 | 200 | — | 403 | 403 |
| `GET /api/dashboard/staff` | 401 | 403 | — | 200 | 200 (+`users`) |
| `GET /api/health` | 200 | 200 | 200 | 200 | 200 |

A session with `mustChangePassword = true` is rejected on all of the above exactly like other protected endpoints (Lab 3).

## 8. Cross-cutting requirements

- CSRF header is checked before touching the database on every mutating endpoint.
- Role and ownership checks occur at the query/service boundary.
- Status change, Action create, and Action update run in a transaction that locks the Ticket row; avoid `Promise.all` around multi-relation `include` queries (Prisma + adapter-pg lesson).
- Responses never contain `passwordHash`, `Session.tokenHash`, `clientRequestId`, stack traces, SQL, or file-system paths.
- Internal Notes remain structurally absent from Requester-scoped payloads; Actions Taken are shared content (BR-11).
- Every Lab 2 and Lab 3 cross-cutting rule remains in force.
