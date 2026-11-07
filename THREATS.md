# LedgerLine – Threat Model

## 1. Project Overview

LedgerLine is a money movement platform designed to provide secure account management, reliable financial transactions, and an append-only accounting ledger.

The application uses React, Node.js, Express, and PostgreSQL through Supabase. It supports three user roles: Administrator, Account Holder, and Auditor.

## 2. Assets to Protect

The following assets are critical to the application:

- User credentials and authentication tokens.
- Customer account information.
- Account balances.
- Transaction records.
- Ledger entries.
- Audit logs.
- Database connection credentials and JWT secrets.

## 3. Potential Threats and Mitigations

| Threat | Potential Impact | Mitigation |
|---|---|---|
| Unauthorized access | Users may access restricted resources. | JWT authentication and role-based authorization. |
| Password theft | Attackers may access customer accounts. | Password hashing using bcrypt. |
| Duplicate transactions | A customer may be charged more than once. | Idempotency keys and duplicate-request validation. |
| Concurrent withdrawals | Multiple requests may withdraw more than the available balance. | Database transactions, row locking, and balance validation. |
| Negative account balance | Financial inconsistencies may occur. | Balance checks and database constraints. |
| Ledger tampering | Historical financial records may be altered. | Database triggers prevent ledger entry updates and deletions. |
| Transaction history modification | Completed transaction records may be changed. | Database triggers prevent transaction updates and deletions. |
| Unauthorized transfers | Attackers may move money without permission. | Server-side authentication, account ownership validation, and role checks. |
| Database credential exposure | Attackers may gain database access. | Environment variables and Git ignore rules. |
| Invalid financial input | Incorrect amounts may affect account balances. | Server-side amount and input validation. |
| Duplicate reversals | A transaction may be reversed multiple times. | Original transaction reference and unique database index. |

## 4. Security Controls Implemented

### Authentication
- Passwords are hashed using bcrypt.
- JWT tokens are used for authenticated requests.
- Tokens have a limited expiration time.
- Authentication middleware validates tokens.

### Authorization
- Three application roles are supported: administrator, account holder, and auditor.
- Protected API routes enforce role-based access.
- Account holders can access only their own accounts and transactions.
- Auditors have read-only access to auditing information.
- Administrative operations require administrator authorization.

### Financial Transaction Safety
- Transactions use PostgreSQL database transactions.
- Account records are locked during financial operations.
- Idempotency keys help prevent duplicate processing.
- Account balances are checked before withdrawals and transfers.
- Financial ledger entries record debit and credit operations.
- Reversals are recorded as new transactions rather than modifying historical records.

### Ledger Integrity
- Ledger entries are append-only.
- Database triggers prevent updates and deletions of ledger entries.
- Completed transactions must have balanced debit and credit entries.
- Database validation checks transaction ledger consistency.

### Infrastructure Security
- Environment variables store sensitive configuration.
- `.env` files and dependency folders are excluded through `.gitignore`.
- Helmet middleware provides HTTP security headers.
- HTTPS is provided by the deployment platforms.

## 5. Testing Against Threats

The following automated tests have been implemented and executed:

- Health endpoint verification.
- Unauthorized API access rejection.
- Role-based authorization checks.
- Idempotency replay testing.
- Concurrent withdrawal safety testing.
- Ledger balance verification.
- Ledger immutability testing.
- Unauthorized transfer rejection.

**Latest recorded test result:** 7 test suites passed, with 12 tests passing.

## 6. Remaining Risks and Limitations

Although security controls have been implemented, some areas require additional verification:

1. Live administrator reversal functionality has not yet been fully tested.
2. Rate limiting and account lockout mechanisms need further consideration.
3. Audit log immutability requires additional protection.
4. Production monitoring and alerting can be improved.
5. Automated security testing should be expanded before handling real financial data.
6. The application is a demonstration project and is not certified for handling real banking funds.

## 7. Conclusion

LedgerLine applies authentication, authorization, transaction safety, idempotency, and append-only ledger controls to reduce financial and application security risks.

The primary design goals are balanced accounting records, prevention of duplicate transaction processing, protection against unauthorized access, and preservation of historical financial records.