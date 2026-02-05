-- Add severity level to audit logs
CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'critical');

ALTER TABLE audit_logs ADD COLUMN severity audit_severity NOT NULL DEFAULT 'info';

CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
