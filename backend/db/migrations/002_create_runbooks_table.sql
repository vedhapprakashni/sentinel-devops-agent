-- Create runbooks table
CREATE TABLE IF NOT EXISTS runbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    triggers JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
