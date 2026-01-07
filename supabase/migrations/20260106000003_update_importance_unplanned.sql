-- Drop old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS valid_importance;

-- Migrate old values 'optional' -> 'unplanned'
UPDATE tasks SET importance = 'unplanned' WHERE importance = 'optional';

-- Add updated constraint with 'unplanned'
ALTER TABLE tasks ADD CONSTRAINT valid_importance 
  CHECK (importance IS NULL OR importance IN ('urgent', 'planned', 'delegated', 'unplanned'));
