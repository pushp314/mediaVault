CREATE TABLE feature_flags (
    key TEXT PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO feature_flags (key, is_enabled, description) VALUES
('enable_audit_logs', true, 'Enable the detailed audit logging and security console'),
('enable_storage_sync', true, 'Enable manual storage synchronization');
