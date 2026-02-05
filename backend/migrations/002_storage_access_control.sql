-- Add is_public column to storage_accounts
ALTER TABLE storage_accounts ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Create storage_account_access table for user-specific access
CREATE TABLE storage_account_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_account_id UUID NOT NULL REFERENCES storage_accounts(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(storage_account_id, employee_id)
);

-- Index for faster access checks
CREATE INDEX idx_storage_account_access_employee ON storage_account_access(employee_id);
CREATE INDEX idx_storage_account_access_account ON storage_account_access(storage_account_id);
