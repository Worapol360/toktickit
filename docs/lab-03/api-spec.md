# Lab 3 API Specification

## 1. Conventions

Base URL: `/api`. All JSON responses use `Content-Type: application/json`. Dates are ISO 8601 UTC strings.

### 1.1 Authentication

Lab 3 replaces the Lab 2 `X-Requester-Id` header with real session authentication. On successful login, the server sets an httpOnly session cookie:

```http
Set-Cookie: ttik_session=<opaque-token>; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=28800
```

Every protected endpoint requires this cookie. The raw token is never persisted server-side; only `sha256(token)` is stored in `Session.tokenHash` so logout can revoke it immediately (see 3.2).

State-changing requests (`POST`, `PATCH`, `DELETE`) must also include `X-Requested-With: XMLHttpRequest`. This is the course-scope CSRF mitigation alongside `SameSite=Lax`; requests missing it are rejected with `403 CSRF_CHECK_FAILED`.

`requesterId` is **never** accepted as a trusted client field anywhere in this API. The authenticated session always determines Requester identity.

### 1.2 Error envelope

Unchanged from Lab 2:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Request validation failed",
		"fields": { "email": "Enter a valid email address" }
	}
}
```

### 1.3 Standard authorization error codes

| Situation | Status | Code |
|---|---:|---|
| No valid session cookie | `401` | `UNAUTHENTICATED` |
| Valid session, role not permitted | `403` | `FORBIDDEN` |
| Valid session, missing CSRF header on a mutating request | `403` | `CSRF_CHECK_FAILED` |
| Resource missing or not owned/visible to this user | `404` | resource-specific `*_NOT_FOUND` |
| State conflict (duplicate email, invalid transition, etc.) | `409` | action-specific |
| Unexpected failure | `500` | `INTERNAL_ERROR` |

`404` is always used instead of `403` when disclosing existence would leak another user's data (e.g., a Requester requesting another Requester's Ticket) — identical to the Lab 2 rule.

## 2. Shared resource shapes

### User (Administrator-facing)
```json
{
	"id": 7,
	"name": "Priya Nair",
	"email": "priya@example.com",
	"role": "IT_STAFF",
	"isActive": true,
	"mustChangePassword": false,
	"createdAt": "2026-09-01T02:00:00.000Z"
}
```
`passwordHash` is never returned by any endpoint.

### Current user (self)
```json
{ "id": 12, "name": "Aiko Tanaka", "email": "aiko@example.com", "role": "REQUESTER", "mustChangePassword": false }
```

### Ticket (extended from Lab 2)
```json
{
	"id": 101,
	"ticketNumber": "TICK-20260825-0001",
	"summary": "Cannot access shared drive",
	"description": "The Finance shared drive has been unavailable since this morning.",
	"requestedPriority": "High",
	"itPriority": "High",
	"status": "Open",
	"requesterId": 12,
	"owner": { "id": 7, "name": "Priya Nair" },
	"requesterMarkedResolved": false,
	"category": { "id": 1, "name": "Hardware", "code": "HARDWARE", "isActive": true },
	"relatedSystem": { "id": 3, "name": "File Services", "code": "FILE_SERVICES", "isActive": true },
	"attachments": [],
	"createdAt": "2026-08-25T09:30:00.000Z",
	"updatedAt": "2026-08-25T09:30:00.000Z"
}
```
`owner` is `null` when unassigned. A Requester-scoped response never includes an `internalNotes` field.

### Public Comment
```json
{ "id": 5, "ticketId": 101, "author": { "id": 12, "name": "Aiko Tanaka", "role": "REQUESTER" }, "content": "Still happening as of 2pm.", "createdAt": "2026-08-25T14:00:00.000Z" }
```

### Internal Note
```json
{ "id": 3, "ticketId": 101, "author": { "id": 7, "name": "Priya Nair", "role": "IT_STAFF" }, "content": "Checked switch port, escalating to network team.", "createdAt": "2026-08-25T14:10:00.000Z" }
```

## 3. Authentication endpoints

### 3.1 Login
`POST /api/auth/login`

```json
{ "email": "aiko@example.com", "password": "correct horse battery" }
```

Success: `200 OK`
```json
{ "user": { "id": 12, "name": "Aiko Tanaka", "email": "aiko@example.com", "role": "REQUESTER", "mustChangePassword": false } }
```
Sets the `ttik_session` cookie.

Errors:
- `400 VALIDATION_ERROR` — missing/malformed email or password.
- `401 INVALID_CREDENTIALS` — unknown email or wrong password (generic; BR-06).
- `403 ACCOUNT_INACTIVE` — credentials correct but `isActive = false` (BR-07).
- `500 INTERNAL_ERROR`.

### 3.2 Logout
`POST /api/auth/logout`

No body. Requires an authenticated session.

Success: `204 No Content`. Sets `Session.revokedAt`, and clears the cookie (`Max-Age=0`). Any further request bearing the old token returns `401 UNAUTHENTICATED`.

### 3.3 Current user
`GET /api/auth/me`

Success: `200 OK` → Current-user shape (Section 2). Unauthenticated: `401 UNAUTHENTICATED`, no body beyond the standard error envelope.

### 3.4 Change password
`POST /api/auth/change-password`

Requires an authenticated session (works even when `mustChangePassword = true` — it is the only reachable action in that state).

```json
{ "currentPassword": "temp-initial-pw", "newPassword": "N3wSecurePass!", "confirmNewPassword": "N3wSecurePass!" }
```

Success: `200 OK` → `{ "user": <current-user shape, mustChangePassword: false> }`. Clears `mustChangePassword`.

Errors:
- `400 VALIDATION_ERROR` — missing fields, `newPassword` under 8 chars or missing a letter/number.
- `400 PASSWORD_MISMATCH` — `newPassword` ≠ `confirmNewPassword`.
- `400 SAME_AS_CURRENT` — new password equals current password.
- `401 CURRENT_PASSWORD_INCORRECT` — `currentPassword` does not match.
- `401 UNAUTHENTICATED`.

## 4. Requester endpoints (Lab 2 continuation)

All Lab 2 requester-scoped endpoints keep their **path, method, and response shape**. The only change is the ownership source: `requesterId` is now derived from the session, and the `X-Requester-Id` header and its `REQUESTER_CONTEXT_INVALID` error are retired. `GET /api/requesters` (the Lab 2 development selector) is removed.

- `GET /api/categories` — unchanged.
- `GET /api/related-systems` — unchanged.
- `POST /api/tickets` — unchanged contract; `requesterId` taken from session (AC-03). Requires role `REQUESTER`.
- `GET /api/tickets` — unchanged query contract (`search`, `status`, `priority`, `categoryId`, `sortBy`, `sortOrder`, `page`, `pageSize`); scoped to the session's Requester.
- `GET /api/tickets/:id` — unchanged; `404 TICKET_NOT_FOUND` for cross-requester access.
- `POST /api/tickets/:id/attachments`, `GET /api/tickets/:id/attachments/:attachmentId`, `.../download`, `DELETE /api/tickets/:id/attachments/:attachmentId` — unchanged.
- Missing/expired session on any of the above returns `401 UNAUTHENTICATED` (replacing Lab 2's `400 REQUESTER_CONTEXT_INVALID`). A session with role `IT_STAFF`/`ADMINISTRATOR` calling these Requester-only paths returns `403 FORBIDDEN`.

### 4.1 Public Comments (Requester + Staff + Admin)

`GET /api/tickets/:id/comments`
Requires the caller to be the Ticket's Requester, or role `IT_STAFF`/`ADMINISTRATOR`.

Success: `200 OK` → `{ "comments": [PublicComment] }`, ordered `createdAt ASC`.

`POST /api/tickets/:id/comments`
```json
{ "content": "Still happening as of 2pm." }
```
Success: `201 Created` → `{ "comment": PublicComment }`.

Errors (both endpoints):
- `400 VALIDATION_ERROR` — empty/whitespace-only or outside 5–2000 characters (POST only).
- `404 TICKET_NOT_FOUND` — Ticket missing, or Requester does not own it.
- `403 FORBIDDEN` — authenticated but not the Requester/IT Staff/Administrator for this ticket.

### 4.2 Mark problem as appears resolved (Requester only)

`POST /api/tickets/:id/mark-resolved`

No body. Requires role `REQUESTER` and Ticket ownership.

Success: `200 OK` → `{ "ticket": Ticket }` with `requesterMarkedResolved: true`.

Errors:
- `404 TICKET_NOT_FOUND` — missing or not owned.
- `409 TICKET_ALREADY_CLOSED` — Ticket status is `Closed` or `Cancelled` (BR-15).

## 5. IT Staff endpoints

All endpoints in this section require role `IT_STAFF` or `ADMINISTRATOR`; a `REQUESTER` session returns `403 FORBIDDEN`.

### 5.1 Ticket Queue
`GET /api/staff/tickets`

| Parameter | Type | Default | Contract |
|---|---:|---:|---|
| `search` | string | none | Case-insensitive over `ticketNumber`, `summary`, requester name |
| `status` | string | none | Any value from the Section 5.2 status set |
| `itPriority` | string | none | `Low`/`Medium`/`High`/`Urgent` |
| `ownerId` | integer \| `"unassigned"` | none | Filter by Ticket Owner |
| `categoryId` | integer | none | Exact match |
| `sortBy` | string | `createdAt` | `createdAt`, `ticketNumber`, `itPriority`, `status`, `updatedAt` |
| `sortOrder` | string | `desc` | `asc` \| `desc` |
| `page` | positive integer | `1` | One-based |
| `pageSize` | positive integer | `10` | Max `100` |

Success: `200 OK`
```json
{ "tickets": [Ticket], "pagination": { "page": 1, "pageSize": 10, "totalItems": 24, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": false }, "sort": { "sortBy": "createdAt", "sortOrder": "desc" } }
```

Errors: `400 INVALID_QUERY_PARAMETER`; `500 INTERNAL_ERROR`.

### 5.2 Ticket detail (staff view)
`GET /api/staff/tickets/:id`

Success: `200 OK` → `{ "ticket": Ticket, "comments": [PublicComment], "notes": [InternalNote] }`.

Errors: `404 TICKET_NOT_FOUND` (nonexistent ID only — staff visibility is not ownership-scoped); `400 INVALID_TICKET_ID`.

### 5.3 Claim / assign / reassign ownership
`PATCH /api/staff/tickets/:id/owner`
```json
{ "ownerId": 7 }
```
`ownerId` must reference an active `IT_STAFF` or `ADMINISTRATOR` user.

Success: `200 OK` → `{ "ticket": Ticket }`.

Errors:
- `400 VALIDATION_ERROR` — `ownerId` missing/not an active IT Staff or Administrator (BR-11).
- `404 TICKET_NOT_FOUND` / `404 USER_NOT_FOUND`.

### 5.4 Update IT Priority
`PATCH /api/staff/tickets/:id/priority`
```json
{ "itPriority": "Urgent" }
```
Success: `200 OK` → `{ "ticket": Ticket }`. `requestedPriority` is never modified by this endpoint.

Errors: `400 VALIDATION_ERROR` — unsupported priority value; `404 TICKET_NOT_FOUND`.

### 5.5 Update status
`PATCH /api/staff/tickets/:id/status`
```json
{ "status": "In Progress" }
```
Success: `200 OK` → `{ "ticket": Ticket }`.

Errors:
- `409 INVALID_STATUS_TRANSITION` — target status not permitted from the current status per Section 5.2 of `specification.md` (AC-12).
- `400 VALIDATION_ERROR` — unsupported status value.
- `404 TICKET_NOT_FOUND`.

### 5.6 Internal Notes
`GET /api/staff/tickets/:id/notes` → `200 OK` → `{ "notes": [InternalNote] }`, ordered `createdAt ASC`.

`POST /api/staff/tickets/:id/notes`
```json
{ "content": "Checked switch port, escalating to network team." }
```
Success: `201 Created` → `{ "note": InternalNote }`.

Errors: `400 VALIDATION_ERROR` — empty/whitespace-only or outside 5–2000 characters; `404 TICKET_NOT_FOUND`.

## 6. Administrator endpoints

All endpoints in this section require role `ADMINISTRATOR`; any other role returns `403 FORBIDDEN`.

### 6.1 List users
`GET /api/admin/users`

| Parameter | Type | Default | Contract |
|---|---:|---:|---|
| `search` | string | none | Case-insensitive over `name`, `email` |
| `role` | string | none | `REQUESTER` \| `IT_STAFF` \| `ADMINISTRATOR` |

No pagination or multi-column sort in Lab 3 (out of scope per handout §4.2). Default ordering: `name ASC`.

Success: `200 OK` → `{ "users": [User] }`.

### 6.2 Create user
`POST /api/admin/users`
```json
{ "name": "New Staffer", "email": "new.staff@example.com", "role": "IT_STAFF", "isActive": true, "initialPassword": "Temp1234" }
```

Success: `201 Created` → `{ "user": User }`. The stored account has `mustChangePassword: true`.

Errors:
- `400 VALIDATION_ERROR` — missing/invalid name, email format, unsupported role, invalid `initialPassword` (min 8 chars, letter + number).
- `409 EMAIL_ALREADY_IN_USE` — duplicate email, case-insensitive (BR-09).

### 6.3 Edit user
`PATCH /api/admin/users/:id`
```json
{ "name": "Updated Name", "email": "updated@example.com", "role": "IT_STAFF", "isActive": false }
```
All fields optional; only supplied fields change. Password is never accepted here (BR-17).

Success: `200 OK` → `{ "user": User }`.

Errors:
- `400 VALIDATION_ERROR` — invalid field values.
- `409 EMAIL_ALREADY_IN_USE`.
- `409 CANNOT_DEACTIVATE_SELF` — target `id` equals the caller's own ID and `isActive: false` is requested (BR-19).
- `409 LAST_ACTIVE_ADMIN` — the change would leave zero active Administrators, whether by deactivation or role change away from `ADMINISTRATOR` (BR-20).
- `404 USER_NOT_FOUND`.

### 6.4 Set new initial password
`POST /api/admin/users/:id/reset-password`
```json
{ "newInitialPassword": "Temp5678" }
```

Success: `200 OK` → `{ "user": User }` with `mustChangePassword: true`. All of the target user's existing sessions are revoked (BR-18).

Errors:
- `400 VALIDATION_ERROR` — password fails the same rules as Section 3.4.
- `404 USER_NOT_FOUND`.

## 7. Cross-cutting requirements
- Every mutating endpoint validates the CSRF header (Section 1.1) before touching the database.
- Role and ownership checks happen at the query/service boundary, never only in the route handler's `if` statement guarding a UI concern.
- `passwordHash` and `Session.tokenHash` are never included in any JSON response, log line visible to clients, or error message.
- Internal Notes are structurally absent (not merely filtered client-side) from any response payload built for a Requester-scoped request.
- All Lab 2 cross-cutting rules (ticket/attachment transactional creation, ownership predicate at the query boundary, no leaking of filesystem/stack-trace details) remain in force.
