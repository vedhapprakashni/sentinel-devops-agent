<<<<<<< HEAD
-- Migration 002: Create runbooks and runbook_versions tables

CREATE TABLE IF NOT EXISTS runbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
=======
-- Create runbooks table
CREATE TABLE IF NOT EXISTS runbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
    name VARCHAR(255) NOT NULL,
    description TEXT,
    triggers JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
<<<<<<< HEAD
    connections JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    webhook_secret VARCHAR(128),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
=======
    enabled BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

<<<<<<< HEAD
CREATE INDEX IF NOT EXISTS idx_runbooks_enabled ON runbooks(enabled);
CREATE INDEX IF NOT EXISTS idx_runbooks_created_by ON runbooks(created_by);

-- Runbook versions table (for rollback support)
CREATE TABLE IF NOT EXISTS runbook_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    runbook_id UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Prevent duplicate (runbook_id, version) pairs
    CONSTRAINT runbook_versions_runbook_version_unique UNIQUE (runbook_id, version)
);

CREATE INDEX IF NOT EXISTS idx_runbook_versions_runbook_id ON runbook_versions(runbook_id);
=======
-- Create table for runbook versions (for rollback)
CREATE TABLE IF NOT EXISTS runbook_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    runbook_id UUID REFERENCES runbooks(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    triggers JSONB NOT NULL,
    actions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_runbook_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_runbooks_updated_at
    BEFORE UPDATE ON runbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_runbook_timestamp();
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
