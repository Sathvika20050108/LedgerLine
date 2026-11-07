# PROMPTS.md — AI Usage Log

## Project: LedgerLine
**Developer:** Sathvika Medagam  
**Development period:** November 6–7, 2026

This document records how AI assistance was used during the development of LedgerLine. AI was used as a development aid for planning, code assistance, debugging, testing, and deployment guidance. All generated or suggested code was reviewed, integrated, and tested by the developer.

## 1. AI-assisted development log

| Date | Development task | AI assistance | Developer verification |
|---|---|---|---|
| Nov 6, 2026 | Project architecture and setup | Assistance with selecting React, Express, PostgreSQL, and project structure | Created the project and installed dependencies |
| Nov 6, 2026 | Authentication and authorization | Guidance for JWT authentication, password hashing, and role-based access | Tested login, registration, and role restrictions |
| Nov 6–7, 2026 | Banking transactions | Assistance reviewing deposits, withdrawals, transfers, idempotency, and concurrency handling | Tested money movements and database balances |
| Nov 7, 2026 | Ledger integrity and reversals | Guidance on balanced ledger entries, immutable records, and reversal implementation | Applied database migration and reviewed the implementation |
| Nov 7, 2026 | Automated testing | Assistance creating Jest and Supertest test cases | Ran the test suite: 7 suites and 12 tests passed |
| Nov 7, 2026 | Deployment | Guidance for deploying the backend on Render and frontend on Vercel | Verified deployed API health and frontend functionality |

## 2. Actual issues encountered and resolutions

### Issue 1: Git author identity was not configured
- **Problem:** Git commit failed because the author name and email were not configured.
- **Resolution:** Configured the Git author name and email locally at the global Git configuration level.
- **Result:** The initial project commit succeeded.

### Issue 2: Render health-check path
- **Problem:** The initially considered `/healthz` path was not implemented in the application.
- **Resolution:** Removed the unsupported health-check path from the deployment configuration.
- **Result:** The deployed backend was verified using its existing API health endpoint.

### Issue 3: Frontend and backend deployment routing
- **Problem:** The frontend and backend were deployed as separate services, so frontend API requests needed to reach the Render backend.
- **Resolution:** Added a Vercel rewrite configuration in `frontend/vercel.json`.
- **Result:** The frontend successfully communicated with the deployed backend.

## 3. Representative prompt summaries

The following are summaries of the actual assistance requested during development, not claimed verbatim transcripts:

1. Help design a secure money movement platform with administrator, account-holder, and auditor roles.
2. Review transaction handling for balanced ledger entries, idempotency, and concurrent requests.
3. Help implement role-based access control and protect sensitive API routes.
4. Help prepare automated tests for authorization, idempotency, concurrency, and ledger integrity.
5. Help deploy the Express backend and React frontend using Render and Vercel.

## 4. Related Git commits

| Commit | Description |
|---|---|
| `1082afa` | Initial LedgerLine project implementation |
| `50f6e39` | Configure frontend API rewrite for Render |
| `8323e54` | Add security threat model documentation |

Repository: https://github.com/Sathvika20050108/LedgerLine

## 5. Developer responsibility

AI assistance was used to accelerate development and support debugging. The developer remains responsible for understanding the implementation, reviewing the code, running tests, verifying application behavior, and maintaining the project.

No test results, deployment outcomes, or development issues should be interpreted as verified unless they were actually observed during development.