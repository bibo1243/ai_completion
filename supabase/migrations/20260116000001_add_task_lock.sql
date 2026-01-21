-- Add lock fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lock_password TEXT DEFAULT NULL;

-- Also add to archived_tasks if it exists
ALTER TABLE archived_tasks ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE archived_tasks ADD COLUMN IF NOT EXISTS lock_password TEXT DEFAULT NULL;
