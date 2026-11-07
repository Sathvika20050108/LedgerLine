# LedgerLine API Documentation

## 1. Overview

LedgerLine provides REST APIs for authentication, account management, money movement, statements, administration, and auditing.

**Backend:** Node.js + Express  
**Database:** PostgreSQL  
**Base URL (production):** `https://ledgerline-api-ig56.onrender.com`

All request and response bodies use JSON.

## 2. Authentication

Protected endpoints require a JWT access token.

**Request header:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Authentication endpoints

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |

Registration creates an account-holder user. Login authenticates an existing user and returns an access token.

## 3. Account Management

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/accounts` | Account holder |
| GET | `/api/accounts` | Account holder |
| GET | `/api/accounts/:accountId/statement` | Account holder |

Features:
- Create savings or current accounts.
- Retrieve the authenticated user's accounts.
- View account statements.

## 4. Money Movement

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/transactions/deposit` | Account holder |
| POST | `/api/transactions/withdraw` | Account holder |
| POST | `/api/transactions/transfer` | Account holder |
| GET | `/api/transactions` | Account holder |
| POST | `/api/transactions/:transactionId/reverse` | Administrator |

Features:
- Deposit money into an account.
- Withdraw money subject to balance and account validation.
- Transfer money between eligible accounts.
- Retrieve transaction history.
- Reverse an eligible completed transaction through a new ledger transaction.

Money movement requests use idempotency keys to prevent duplicate processing. Reversals are recorded as new entries rather than modifying historical ledger records.

## 5. Administrator APIs

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/admin/overview` | Administrator |
| GET | `/api/admin/users` | Administrator |
| GET | `/api/admin/accounts` | Administrator |

Administrators can view platform statistics, registered users, and account information.

## 6. Auditor APIs

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/auditor/overview` | Auditor |
| GET | `/api/auditor/transactions` | Auditor |
| GET | `/api/auditor/ledger` | Auditor |
| GET | `/api/auditor/audit-logs` | Auditor |

Auditors have read-only access to transaction records, ledger entries, audit logs, and platform statistics.

## 7. Health Checks

| Method | Endpoint | Access |
|---|---|---|
| GET | `/` | Public |
| GET | `/api/health` | Public |

These endpoints can be used to verify backend availability.

## 8. Security and Integrity

- JWT-based authentication.
- Server-side role-based authorization.
- Password hashing.
- Idempotency protection for money movement.
- Database transactions and account locking.
- Non-negative customer balances.
- Balanced debit and credit ledger entries.
- Append-only ledger and immutable transaction history.
- Audit logging for successful and refused operations.
- Reversals recorded as new transactions.

## 9. Error Responses

API errors use JSON responses containing a success indicator and a descriptive message.

Common HTTP status codes:

| Status | Meaning |
|---|---|
| 200 | Request successful |
| 201 | Resource created |
| 400 | Invalid request |
| 401 | Authentication required or invalid |
| 403 | Access denied |
| 404 | Resource not found |
| 409 | Conflict or duplicate request |
| 500 | Internal server error |

## 10. Deployment

- Frontend: Vercel
- Backend: Render
- Database: Supabase PostgreSQL

**GitHub repository:** https://github.com/Sathvika20050108/LedgerLine