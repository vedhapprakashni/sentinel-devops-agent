-- Seed Data: System Permissions and Roles
-- This file populates the permissions table and creates system roles

-- Insert all system permissions
INSERT INTO permissions (name, resource, action, description) VALUES
  -- Container permissions
  ('containers:read', 'containers', 'read', 'View container information'),
  ('containers:write', 'containers', 'write', 'Modify container configuration'),
  ('containers:delete', 'containers', 'delete', 'Delete containers'),
  ('containers:restart', 'containers', 'restart', 'Restart containers'),
  
  -- Alert permissions
  ('alerts:read', 'alerts', 'read', 'View alerts'),
  ('alerts:write', 'alerts', 'write', 'Create and modify alerts'),
  ('alerts:delete', 'alerts', 'delete', 'Delete alerts'),
  ('alerts:acknowledge', 'alerts', 'acknowledge', 'Acknowledge alerts'),
  
  -- Log permissions
  ('logs:read', 'logs', 'read', 'View logs'),
  ('logs:export', 'logs', 'export', 'Export logs'),
  
  -- User permissions
  ('users:read', 'users', 'read', 'View users'),
  ('users:write', 'users', 'write', 'Create and modify users'),
  ('users:delete', 'users', 'delete', 'Delete users'),
  
  -- Role permissions
  ('roles:read', 'roles', 'read', 'View roles'),
  ('roles:write', 'roles', 'write', 'Create and modify roles'),
  ('roles:delete', 'roles', 'delete', 'Delete roles'),
  
  -- Organization permissions
  ('organizations:read', 'organizations', 'read', 'View organizations'),
  ('organizations:write', 'organizations', 'write', 'Create and modify organizations'),
  ('organizations:delete', 'organizations', 'delete', 'Delete organizations'),
  
  -- Team permissions
  ('teams:read', 'teams', 'read', 'View teams'),
  ('teams:write', 'teams', 'write', 'Create and modify teams'),
  ('teams:delete', 'teams', 'delete', 'Delete teams'),
  
  -- API key permissions
  ('api_keys:read', 'api_keys', 'read', 'View API keys'),
  ('api_keys:write', 'api_keys', 'write', 'Create and modify API keys'),
  ('api_keys:delete', 'api_keys', 'delete', 'Delete API keys'),
  
  -- Audit log permissions
  ('audit_logs:read', 'audit_logs', 'read', 'View audit logs'),
  
  -- Admin permissions
  ('admin:access', 'admin', 'access', 'Access admin dashboard')
ON CONFLICT (name) DO NOTHING;

-- Create default organization
INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Default Organization')
ON CONFLICT DO NOTHING;

-- Create system roles for default organization
-- Admin Role
INSERT INTO roles (id, name, description, organization_id, is_system_role) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Admin', 'Full system access with all permissions', '00000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT (name, organization_id) DO NOTHING;

-- Operator Role
INSERT INTO roles (id, name, description, organization_id, is_system_role) VALUES
  ('00000000-0000-0000-0000-000000000020', 'Operator', 'Can manage containers, alerts, and logs', '00000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT (name, organization_id) DO NOTHING;

-- Viewer Role
INSERT INTO roles (id, name, description, organization_id, is_system_role) VALUES
  ('00000000-0000-0000-0000-000000000030', 'Viewer', 'Read-only access to containers, alerts, and logs', '00000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT (name, organization_id) DO NOTHING;

-- Assign all permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000010', id FROM permissions
ON CONFLICT DO NOTHING;

-- Assign Operator permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000020', id FROM permissions
WHERE name IN (
  'containers:read',
  'containers:write',
  'containers:restart',
  'alerts:read',
  'alerts:write',
  'alerts:acknowledge',
  'logs:read',
  'logs:export'
)
ON CONFLICT DO NOTHING;

-- Assign Viewer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000030', id FROM permissions
WHERE name IN (
  'containers:read',
  'alerts:read',
  'logs:read'
)
ON CONFLICT DO NOTHING;
