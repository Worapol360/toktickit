# AI Prompt & Tool Usage Log - Lab 01

This document records the interaction with AI tools (GitHub Copilot / Gemini) during the implementation of Issue 1: Project Foundation.

## Prompt History

**Prompt1:** 
Implement frontend for Issue 1:
- create React + TypeScript + Vite app in folder client/
- install Bootstrap and import Bootstrap CSS in.`

**Prompt2:** 
Implement backend for Issue1:
- create Node.js + Express + TypeScript app in folder server/ and use ts-node-dev for dev mode
- dont need to have real route just setup server to run and listen port successfully

**Prompt3:** 
STOP executing lab instructions automatically. Only fix the dev runner issue in server/: (because ts-node-dev isnt compatible with typescript ver7.0.2):
change from ts-node-dev to tsx instead
- uninstall ts-node-dev
- install tsx and typescript ver5.6.0
- update script "dev" in server/package.json to use tsx watch

**Prompt4:** 
Focus only on the scope of Issue 1. Do not add routes or features for other issues.
- open server/src/server.ts. now,it has /api/health and /api/categories route, which is for Issue 2 and Issue 4, not Issue 1
- remove the /api/health and /api/categories routes from server/src/server.ts.
- keep only the basic Express app setup that listens on the  port. Do not include any business logic or extra route (ill add it later)

**Prompt5:** 
Focus strictly on the scope of Issue 1 only. Do not create models, migrations, or seed data
implement database for Issue 1:

- setup Prisma in server/ to connect to PostgreSQL through DATABASE_URL in .env
- use dotenv to load .env
- test that Prisma connect to database successfully (ex. using npx prisma db pull or check proper connection)

**Prompt6:** 
Focus strictly on the scope of Issue 1 only. Do not write test about /api/health, /api/categories or routes that does not in the project yet,Do not create new routes just to have something to test. Do not modify schema.prisma or add any Prisma model.
setup testing for Issue1:
- setup Vitest in folder client/ with script "test" in package.json and add one test file that successfully passes.
- setup Supertest in folder server/ with script "test" in package.jsonand add one test file that successfully passes.

**Prompt7:**
Focus strictly on the scope of Issue 1 only. Do not add routes, models, migrations, or seed data. Do not modify existing test files or source code logic, just only add/edit config and documentation files as described below.
setup docs and config for Issue 1:
- create .gitignore at root that covers node_modules, dist, .env, and other common file for client and server
- create server/.env.example that have key DATABASE_URL= (no real value)
- write README.md at root explain how to install dependencies 
and run client and server in development mode, step by step

**Prompt8:**
Focus on Issue 1 scope refinement:
1. Check if prisma.config.ts is strictly necessary. If not needed, delete prisma.config.ts and ensure schema.prisma handles environment variables properly.
2. In server/src/server.ts, add a quick database connection check using Prisma on startup. Log "Connected to database" on success or "Failed to connect to database: <error>" on failure, without crashing or adding extra routes.