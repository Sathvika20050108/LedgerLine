# LedgerLine Deployment and Setup Guide

## 1. Project Overview

LedgerLine is a money movement platform built using React, Node.js, Express, and PostgreSQL.

### Technology Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (Supabase)
- Authentication: JWT
- Testing: Jest + Supertest
- Frontend hosting: Vercel
- Backend hosting: Render

## 2. Prerequisites

Install the following:
- Node.js and npm
- Git
- Visual Studio Code
- A Supabase account for PostgreSQL
- A Render account
- A Vercel account

## 3. Clone the Repository

```bash
git clone https://github.com/Sathvika20050108/LedgerLine.git
cd LedgerLine
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
cd ../backend
npm install
```

## 4. Database Configuration

1. Create a PostgreSQL project in Supabase.
2. Obtain the PostgreSQL connection string.
3. Open the Supabase SQL Editor.
4. Execute the database setup script located at:

`backend/database/schema.sql`

The database contains tables for users, accounts, transactions, ledger entries, and audit logs.

## 5. Backend Environment Configuration

Create a `.env` file inside the `backend` directory.

Add the following variables:

```env
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secure_random_secret
NODE_ENV=development
```

Replace the placeholder values with your own credentials.

**Security:** Never commit `.env` files or expose database credentials and JWT secrets in the frontend or public repository.

## 6. Run the Backend Locally

From the `backend` directory:

```bash
npm run dev
```

The API runs at:

`http://localhost:5000`

Health check:

`http://localhost:5000/api/health`

## 7. Run the Frontend Locally

From the `frontend` directory, open another terminal:

```bash
npm run dev
```

Vite displays the local frontend URL in the terminal, usually:

`http://localhost:5173`

## 8. Automated Tests

From the `backend` directory:

```bash
npm test
```

The test suite covers health checks, authentication, authorization, idempotency, concurrency, unauthorized transfers, and ledger integrity.

## 9. Production Deployment

### Backend — Render

1. Connect the GitHub repository to Render.
2. Create a Web Service.
3. Set the root directory to `backend`.
4. Build command: `npm install`
5. Start command: `node server.js`
6. Configure `DATABASE_URL`, `JWT_SECRET`, and `NODE_ENV=production` as environment variables.
7. Deploy and verify the API health endpoint.

Production backend:

`https://ledgerline-api-ig56.onrender.com`

### Frontend — Vercel

1. Import the GitHub repository into Vercel.
2. Set the root directory to `frontend`.
3. Select the Vite framework preset.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy the frontend.

The `frontend/vercel.json` file configures API requests to reach the Render backend.

## 10. Important Security Notes

- Keep all credentials in environment variables.
- Never expose database credentials or JWT secrets.
- Use HTTPS in production.
- Keep customer balances and ledger operations under server-side control.
- Restrict administrative and auditor operations by role.
- Do not modify historical ledger entries.

## 11. Repository

GitHub: https://github.com/Sathvika20050108/LedgerLine