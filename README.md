# TokTickIT

TokTickIT is the full-stack IT service desk starter for Lab 1.

This repository is organized as a monorepo with a React + TypeScript + Vite frontend in the client folder and an Express + TypeScript server in the server folder.

## Project Structure

- client/: Vite + React + TypeScript frontend
- server/: Express + TypeScript backend and Prisma/PostgreSQL setup
- docs/: Lab documentation and assignment artifacts

## Install dependencies

From the repository root:

1. Install the client dependencies:

```bash
cd client
npm install
```

2. Install the server dependencies:

```bash
cd ../server
npm install
```

## Configure environment

Create a local environment file for the server from the provided example:

```bash
cd server
copy .env.example .env
```

Then edit the DATABASE_URL line in the .env file to match your local PostgreSQL instance.

## Run in development mode

### Frontend

Open a terminal in the repository root and run:

```bash
cd client
npm run dev
```

The Vite development server will serve the React UI locally.

### Backend

Open a terminal in the repository root and run:

```bash
cd server
npm run dev
```

The Express API will start with tsx watch, reloading automatically when the server source changes.

## Production build

For the frontend:

```bash
cd client
npm run build
```

For the server:

```bash
cd server
npm run build
```
