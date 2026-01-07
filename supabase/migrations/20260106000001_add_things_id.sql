-- Add things_id column to tasks table for Things 3 integration
-- This stores the Things 3 UUID to prevent duplicate imports
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS things_id TEXT;

-- Create index for fast lookup by things_id
CREATE INDEX IF NOT EXISTS idx_tasks_things_id ON tasks(things_id) WHERE things_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tasks.things_id IS 'Things 3 UUID - used to prevent duplicate imports from Things 3 sync';
