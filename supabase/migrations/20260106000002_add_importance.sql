-- Add importance column to tasks table
-- Values: 'urgent' (red), 'planned' (yellow), 'delegated' (green), 'optional' (gray)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS importance TEXT;

-- Add check constraint for valid importance values
ALTER TABLE tasks ADD CONSTRAINT valid_importance 
  CHECK (importance IS NULL OR importance IN ('urgent', 'planned', 'delegated', 'optional'));

-- Create index for filtering by importance
CREATE INDEX IF NOT EXISTS idx_tasks_importance ON tasks(importance) WHERE importance IS NOT NULL;
