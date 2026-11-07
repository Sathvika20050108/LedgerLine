
-- =====================================================
-- LEDGERLINE DATABASE SCHEMA
-- PostgreSQL / Supabase
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. USERS
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'account_holder'
        CHECK (role IN ('administrator', 'account_holder', 'auditor')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. ACCOUNTS
-- =====================================================

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES users(id),

    account_number VARCHAR(20) NOT NULL UNIQUE,

    account_type VARCHAR(30) NOT NULL DEFAULT 'savings',

    account_kind VARCHAR(20) NOT NULL DEFAULT 'customer'
        CHECK (account_kind IN ('customer', 'platform')),

    balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'frozen', 'closed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT account_owner_check CHECK (
        (account_kind = 'customer' AND user_id IS NOT NULL AND balance >= 0)
        OR
        (account_kind = 'platform' AND user_id IS NULL)
    )
);

-- Internal clearing account
INSERT INTO accounts (
    account_number,
    account_type,
    account_kind
)
VALUES (
    'PLATFORM-CLEARING',
    'clearing',
    'platform'
)
ON CONFLICT (account_number) DO NOTHING;


-- =====================================================
-- 3. TRANSACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    idempotency_key VARCHAR(100) NOT NULL UNIQUE,

    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN (
            'deposit',
            'withdrawal',
            'transfer',
            'reversal'
        )),

    from_account_id UUID REFERENCES accounts(id),

    to_account_id UUID REFERENCES accounts(id),

    amount NUMERIC(18, 2) NOT NULL
        CHECK (amount > 0),

    status VARCHAR(20) NOT NULL
        CHECK (status IN ('pending', 'completed', 'failed', 'refused')),

    initiated_by UUID NOT NULL REFERENCES users(id),

    description TEXT,

    original_transaction_id UUID UNIQUE REFERENCES transactions(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT transaction_accounts_check CHECK (
        (
            transaction_type = 'deposit'
            AND from_account_id IS NULL
            AND to_account_id IS NOT NULL
            AND original_transaction_id IS NULL
        )
        OR
        (
            transaction_type = 'withdrawal'
            AND from_account_id IS NOT NULL
            AND to_account_id IS NULL
            AND original_transaction_id IS NULL
        )
        OR
        (
            transaction_type = 'transfer'
            AND from_account_id IS NOT NULL
            AND to_account_id IS NOT NULL
            AND from_account_id <> to_account_id
            AND original_transaction_id IS NULL
        )
        OR
        (
            transaction_type = 'reversal'
            AND from_account_id IS NOT NULL
            AND to_account_id IS NOT NULL
            AND from_account_id <> to_account_id
            AND original_transaction_id IS NOT NULL
        )
    )
);


-- =====================================================
-- 4. LEDGER ENTRIES
-- =====================================================

CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id UUID NOT NULL REFERENCES transactions(id),

    account_id UUID NOT NULL REFERENCES accounts(id),

    entry_type VARCHAR(10) NOT NULL
        CHECK (entry_type IN ('debit', 'credit')),

    amount NUMERIC(18, 2) NOT NULL
        CHECK (amount > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. AUDIT LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID REFERENCES users(id),

    action VARCHAR(50) NOT NULL,

    resource_type VARCHAR(50),

    resource_id UUID,

    status VARCHAR(20) NOT NULL
        CHECK (status IN ('success', 'refused', 'failed')),

    details TEXT,

    amount NUMERIC(18, 2),

    ip_address INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Also supports upgrading an existing database
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS amount NUMERIC(18, 2);

-- =====================================================
-- 6. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_accounts_user_id
ON accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_kind
ON accounts(account_kind);

CREATE INDEX IF NOT EXISTS idx_transactions_from_account
ON transactions(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_to_account
ON transactions(to_account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_initiated_by
ON transactions(initiated_by);

CREATE INDEX IF NOT EXISTS idx_ledger_account_id
ON ledger_entries(account_id);

CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id
ON ledger_entries(transaction_id);

CREATE INDEX IF NOT EXISTS idx_audit_user_id
ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_resource
ON audit_logs(resource_type, resource_id);

-- =====================================================
-- 7. PREVENT LEDGER MODIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_ledger_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Ledger entries cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entries_immutable
ON ledger_entries;

CREATE TRIGGER ledger_entries_immutable
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_entry_changes();

-- =====================================================
-- 8. PREVENT TRANSACTION MODIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Transactions cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_immutable
ON transactions;

CREATE TRIGGER transactions_immutable
BEFORE UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_transaction_changes();

-- =====================================================
-- 9. VERIFY DOUBLE-ENTRY LEDGER BALANCING
-- Deferred validation runs at transaction commit.
-- =====================================================

CREATE OR REPLACE FUNCTION check_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
    target_transaction_id UUID;
    transaction_status VARCHAR(20);
    expected_amount NUMERIC(18, 2);
    debit_total NUMERIC(18, 2);
    credit_total NUMERIC(18, 2);
    debit_count INTEGER;
    credit_count INTEGER;
    entry_count INTEGER;
BEGIN

    IF TG_TABLE_NAME = 'transactions' THEN
        target_transaction_id := NEW.id;
    ELSE
        target_transaction_id := NEW.transaction_id;
    END IF;

    SELECT status, amount
    INTO transaction_status, expected_amount
    FROM transactions
    WHERE id = target_transaction_id;

    IF transaction_status = 'completed' THEN

        SELECT
            COALESCE(SUM(amount) FILTER (
                WHERE entry_type = 'debit'
            ), 0),

            COALESCE(SUM(amount) FILTER (
                WHERE entry_type = 'credit'
            ), 0),

            COUNT(*) FILTER (
                WHERE entry_type = 'debit'
            ),

            COUNT(*) FILTER (
                WHERE entry_type = 'credit'
            ),

            COUNT(*)

        INTO
            debit_total,
            credit_total,
            debit_count,
            credit_count,
            entry_count

        FROM ledger_entries
        WHERE transaction_id = target_transaction_id;

        IF entry_count <> 2
           OR debit_count <> 1
           OR credit_count <> 1
           OR debit_total <> credit_total
           OR debit_total <> expected_amount
           OR credit_total <> expected_amount
        THEN
            RAISE EXCEPTION
                'Transaction % has invalid or unbalanced ledger entries',
                target_transaction_id;
        END IF;

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Validate transactions at commit
DROP TRIGGER IF EXISTS verify_transaction_balance
ON transactions;

CREATE CONSTRAINT TRIGGER verify_transaction_balance
AFTER INSERT OR UPDATE ON transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_transaction_balance();

-- Validate ledger entries at commit
DROP TRIGGER IF EXISTS verify_ledger_balance
ON ledger_entries;

CREATE CONSTRAINT TRIGGER verify_ledger_balance
AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_transaction_balance();

-- =====================================================
-- END OF LEDGERLINE DATABASE SCHEMA
-- =====================================================
