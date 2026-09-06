# Lab 2 API Specification

## 1. Conventions

Base URL: `/api`

All JSON responses use `Content-Type: application/json`. Dates are ISO 8601 UTC strings. Numeric IDs are positive integers unless otherwise stated.

### Development requester context

Lab 2 has no authentication. Every requester-scoped request MUST provide the selected active requester ID in the `X-Requester-Id` header:

```http
X-Requester-Id: 12
```

The server uses this header as the requester context; a requester ID in a body or query string MUST NOT override it. Missing, non-numeric, or inactive requester context returns `400 Bad Request`.

### Error envelope

Unless an endpoint specifies a different representation, errors have this shape:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Request validation failed",
		"fields": {
			"summary": "Summary must be between 5 and 100 characters"
		}
	}
}
```

`fields` is optional and maps request field names to human-readable messages. Error codes are stable machine-readable identifiers.

Ownership failures for requester-owned resources MUST return `404 Not Found`, whether the resource does not exist or belongs to another requester. The response MUST NOT reveal which condition occurred.

## 2. Shared resource shapes

### Requester

```json
{
	"id": 12,
	"name": "Aiko Tanaka",
	"email": "aiko@example.com",
	"department": "Finance",
	"isActive": true
}
```

### Category and related system

```json
{
	"id": 1,
	"name": "Hardware",
	"code": "HARDWARE",
	"isActive": true
}
```

### Attachment

```json
{
	"id": 41,
	"fileName": "screen.png",
	"fileSize": 245760,
	"fileType": "image/png",
	"isRemoved": false,
	"removalReason": null,
	"createdAt": "2026-08-25T09:30:00.000Z"
}
```

`fileSize` is bytes. `filePath` is never returned to clients. For a removed attachment, metadata remains available, `isRemoved` is `true`, `removalReason` is populated, and preview/download operations are unavailable.

### Ticket

```json
{
	"id": 101,
	"ticketNumber": "TICK-20260825-0001",
	"summary": "Cannot access shared drive",
	"description": "The Finance shared drive has been unavailable since this morning.",
	"requestedPriority": "High",
	"status": "New",
	"requesterId": 12,
	"category": { "id": 1, "name": "Hardware", "code": "HARDWARE", "isActive": true },
	"relatedSystem": { "id": 3, "name": "File Services", "code": "FILE_SERVICES", "isActive": true },
	"attachments": [],
	"createdAt": "2026-08-25T09:30:00.000Z",
	"updatedAt": "2026-08-25T09:30:00.000Z"
}
```

`status` is always `New` for tickets created in Lab 2 and cannot be changed through these APIs. Implementations MAY return category and related-system IDs in addition to the nested objects, but the nested objects and the stable fields above are required.

## 3. Endpoint contracts

### 3.1 List active requesters

`GET /api/requesters`

No request body or query parameters. This endpoint is intentionally not requester-scoped.

Success: `200 OK`

```json
{ "requesters": [Requester] }
```

Only records with `isActive = true` are returned. Results are ordered by `name ASC`, then `id ASC`.

Errors:

- `500 Internal Server Error`, code `INTERNAL_ERROR`, if the requester list cannot be read.

### 3.2 List active categories

`GET /api/categories`

No request body or query parameters. This endpoint is intentionally not requester-scoped.

Success: `200 OK`

```json
{ "categories": [Category] }
```

Only active categories are returned, ordered by `name ASC`, then `id ASC`.

Errors:

- `500 Internal Server Error`, code `INTERNAL_ERROR`, if the category list cannot be read.

### 3.3 List active related systems

`GET /api/related-systems`

No request body or query parameters. This endpoint is intentionally not requester-scoped.

Success: `200 OK`

```json
{ "relatedSystems": [RelatedSystem] }
```

Only active related systems are returned, ordered by `name ASC`, then `id ASC`.

Errors:

- `500 Internal Server Error`, code `INTERNAL_ERROR`, if the related-system list cannot be read.

### 3.4 Create a ticket

`POST /api/tickets`

Headers:

- Required: `X-Requester-Id: integer`
- `Content-Type: multipart/form-data` when files are supplied; `application/json` is allowed when there are no files.

JSON fields or multipart text fields:

| Field | Type | Required | Rules |
|---|---|---:|---|
| `summary` | string | Yes | Trimmed; 5-100 characters |
| `description` | string | Yes | Trimmed; 10-2000 characters |
| `requestedPriority` | string | Yes | Supported priority enum, for example `Low`, `Medium`, `High`, `Urgent` |
| `categoryId` | integer | Yes | Must reference an active category |
| `relatedSystemId` | integer | Yes | Must reference an active related system |
| `attachments` | file[] | No | JPG/JPEG/PNG/WEBP/PDF, each at most 5 MB, at most 5 active files |

For multipart requests, files use repeated `attachments` parts. The requester is taken from `X-Requester-Id`; `requesterId` is not accepted as a trusted input field.

Success: `201 Created`

```json
{ "ticket": Ticket }
```

The server generates the unique `ticketNumber`, sets `status` to `New`, and returns the created ticket with attachment metadata.

Validation and duplicate errors:

- `400 Bad Request`, code `REQUESTER_CONTEXT_INVALID`, for missing/invalid/inactive requester context.
- `400 Bad Request`, code `VALIDATION_ERROR`, for missing fields, invalid types, unsupported priority, failed length rules, or inactive/nonexistent category or related system. Trimmed values are used for validation and persistence.
- `400 Bad Request`, code `FILE_TOO_LARGE`, if any file exceeds 5 MB.
- `400 Bad Request`, code `UNSUPPORTED_FILE_TYPE`, if any file is not JPG, JPEG, PNG, WEBP, or PDF. Validation uses the file's detected type and extension, not extension alone.
- `409 Conflict`, code `DUPLICATE_SUBMISSION`, if the same requester submits the same trimmed `summary` and `description` within 5 seconds. The response does not create another ticket.
- `500 Internal Server Error`, code `ATTACHMENT_UPLOAD_FAILED`, if metadata or any attachment cannot be committed. The server rolls back the ticket, or marks it incomplete according to the implementation transaction policy, and the client retains its form data for retry.
- `500 Internal Server Error`, code `INTERNAL_ERROR`, for other persistence failures.

### 3.5 List my tickets

`GET /api/tickets`

Required header: `X-Requester-Id: integer`. The requester ID is never accepted as a query parameter. The result is always restricted to that requester.

#### Query parameters

| Parameter | Type | Default | Contract |
|---|---|---:|---|
| `search` | string | none | Case-insensitive search over `ticketNumber`, `summary`, and `description`; whitespace is trimmed; empty after trimming means no search filter |
| `status` | string | none | Exact filter; Lab 2 currently permits `New` |
| `priority` | string | none | Exact supported priority value: `Low`, `Medium`, `High`, or `Urgent` |
| `categoryId` | integer | none | Exact category ID filter |
| `sortBy` | string | `createdAt` | `createdAt`, `ticketNumber`, `summary`, `requestedPriority`, or `status` |
| `sortOrder` | string | `desc` | `asc` or `desc`; default ordering is `createdAt DESC` |
| `page` | positive integer | `1` | One-based page number |
| `pageSize` | positive integer | `10` | Number of records per page; maximum `100` |

Success: `200 OK`

```json
{
	"tickets": [Ticket],
	"pagination": {
		"page": 1,
		"pageSize": 10,
		"totalItems": 24,
		"totalPages": 3,
		"hasNextPage": true,
		"hasPreviousPage": false
	},
	"sort": { "sortBy": "createdAt", "sortOrder": "desc" }
}
```

`totalItems` is calculated after requester ownership, search, and filters. A page beyond `totalPages` returns `200 OK` with an empty `tickets` array. With no filters and `totalItems = 0`, clients show the Empty State. With at least one search/filter parameter and no matches, clients show the No-Results State.

Invalid query behavior:

- `400 Bad Request`, code `INVALID_QUERY_PARAMETER`, for unknown parameters, non-integer/zero/negative `page` or `pageSize`, `pageSize > 100`, unsupported enum values, invalid `categoryId`, invalid `sortBy`, or invalid `sortOrder`.
- `400 Bad Request`, code `REQUESTER_CONTEXT_INVALID`, for missing/invalid/inactive requester context.
- `500 Internal Server Error`, code `INTERNAL_ERROR`, for database failures.

### 3.6 Get a ticket

`GET /api/tickets/:id`

Required header: `X-Requester-Id: integer`. Path parameter `id` is a positive integer ticket ID. No body.

Success: `200 OK`

```json
{ "ticket": Ticket }
```

Errors:

- `400 Bad Request`, code `INVALID_TICKET_ID`, for a malformed path ID or invalid requester context.
- `404 Not Found`, code `TICKET_NOT_FOUND`, when the ticket does not exist or is owned by another requester.
- `500 Internal Server Error`, code `INTERNAL_ERROR`, for database failures.

### 3.7 Upload an attachment to a ticket

`POST /api/tickets/:id/attachments`

Required header: `X-Requester-Id: integer`; `Content-Type: multipart/form-data`. Path `id` is a positive integer. The request contains one or more repeated `attachments` file parts.

Success: `201 Created`

```json
{ "attachments": [Attachment] }
```

The upload is allowed only for an owned ticket. The active attachment count after the upload cannot exceed 5.

Errors:

- `400 Bad Request`, code `INVALID_TICKET_ID` or `REQUESTER_CONTEXT_INVALID`, for malformed IDs/context.
- `400 Bad Request`, code `NO_FILE`, if no attachment is supplied.
- `400 Bad Request`, code `FILE_TOO_LARGE`, for a file over 5 MB.
- `400 Bad Request`, code `UNSUPPORTED_FILE_TYPE`, for a file outside JPG/JPEG/PNG/WEBP/PDF.
- `409 Conflict`, code `ATTACHMENT_LIMIT_EXCEEDED`, if active attachments would exceed 5.
- `404 Not Found`, code `TICKET_NOT_FOUND`, if the ticket is missing or not owned by the requester.
- `500 Internal Server Error`, code `INTERNAL_ERROR`, if storage or persistence fails.

### 3.8 Get attachment metadata

`GET /api/tickets/:id/attachments/:attachmentId`

Required header: `X-Requester-Id: integer`. Path parameters `id` and `attachmentId` are positive integers. No body.

Success: `200 OK`

```json
{ "attachment": Attachment }
```

Metadata for removed attachments remains retrievable.

Errors:

- `400 Bad Request`, code `INVALID_PATH_PARAMETER` or `REQUESTER_CONTEXT_INVALID`, for malformed IDs/context.
- `404 Not Found`, code `ATTACHMENT_NOT_FOUND`, if the ticket or attachment does not exist, the attachment is not associated with the ticket, or the ticket is not owned by the requester.
- `500 Internal Server Error`, code `INTERNAL_ERROR`, for database failures.

### 3.9 Download an attachment

`GET /api/tickets/:id/attachments/:attachmentId/download`

Required header: `X-Requester-Id: integer`. Path parameters `id` and `attachmentId` are positive integers. No body.

Success: `200 OK` with the binary file body, its stored `Content-Type`, and `Content-Disposition: attachment; filename="<original file name>"`.

Errors:

- `400 Bad Request`, code `INVALID_PATH_PARAMETER` or `REQUESTER_CONTEXT_INVALID`, for malformed IDs/context.
- `404 Not Found`, code `ATTACHMENT_NOT_FOUND`, if the ticket/attachment is missing, not associated, not owned by the requester, or `isRemoved = true`. Removed attachments must not expose binary content.
- `500 Internal Server Error`, code `FILE_UNAVAILABLE` if metadata exists but the binary cannot be read, or `INTERNAL_ERROR` for another server failure.

### 3.10 Soft-remove an attachment

`DELETE /api/tickets/:id/attachments/:attachmentId`

Required header: `X-Requester-Id: integer`. Path parameters `id` and `attachmentId` are positive integers.

JSON body:

```json
{ "removalReason": "Uploaded the wrong version" }
```

`removalReason` is required, trimmed, and must contain 5-250 characters.

Success: `200 OK`

```json
{ "attachment": Attachment }
```

The response has `isRemoved: true`, retains the file metadata, and includes the stored removal reason. The operation is idempotent only if the attachment is already removed with the same reason; otherwise an already removed attachment returns `409 Conflict`.

Errors:

- `400 Bad Request`, code `INVALID_PATH_PARAMETER` or `REQUESTER_CONTEXT_INVALID`, for malformed IDs/context.
- `400 Bad Request`, code `VALIDATION_ERROR`, if the body is missing, malformed, or the trimmed reason is shorter than 5 or longer than 250 characters.
- `404 Not Found`, code `ATTACHMENT_NOT_FOUND`, if the ticket/attachment is missing, not associated, or the ticket is not owned by the requester.
- `409 Conflict`, code `ATTACHMENT_ALREADY_REMOVED`, if the attachment was already removed with a different reason.
- `500 Internal Server Error`, code `INTERNAL_ERROR`, for database failures.

## 4. Cross-cutting requirements

- Ticket creation and its initial attachment uploads are one coordinated operation. A failed upload MUST NOT leave an apparently complete ticket available to the requester.
- All requester-owned lookups, searches, attachment operations, and downloads apply the requester ownership predicate at the database query boundary.
- Ticket IDs, requester IDs, category IDs, and related-system IDs must be validated before database queries.
- Server errors should be logged with an internal correlation/request ID, but filesystem paths, stack traces, and database details must not be returned to clients.
- Clients must preserve entered ticket form fields after any failed create request, including validation, duplicate, network, and attachment errors.
