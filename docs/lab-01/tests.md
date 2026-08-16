# Lab 1 Automated Tests

This document lists the automated tests that verify the TokTickIT Lab 1 vertical slice
(React → Express → Prisma → PostgreSQL) works correctly, as required by the lab specification.

Test files are located under `tests/lab-01/` (server) and `client/tests/lab-01/` (frontend).

## Test Summary

| Test File | Tool | Test Description |
|---|---|---|
| API-01 | Supertest | Health endpoint (`GET /api/health`) returns 200 and expected JSON (`status: "ok"`, `service: "TokTickIT API"`) |
| API-02 | Supertest | Categories endpoint (`GET /api/categories`) returns the four seeded categories (Account and Access, Hardware, Software, Network) in predictable order |
| UI-01 | Vitest | "TokTickIT" heading renders on the main page |
| UI-02 | Vitest | Loading state changes to category list once data is returned from the API |
| UI-03 | Vitest | API failure displays a useful error message ("System Status: Offline — Unable to connect to TokTickIT API") |

## How to Run

**Backend tests (Supertest):**
```bash
cd server
npm test
```

**Frontend tests (Vitest):**
```bash
cd client
npm test
```

## Result

All tests above pass on the `main` branch after merging `lab1-staging`.

_(Insert terminal output / screenshot showing all tests passing here before submitting the PDF.)_
