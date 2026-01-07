-- Add repeat_rule column for recurring/repeating tasks
-- This stores the recurrence pattern as JSONB
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repeat_rule JSONB DEFAULT NULL;

-- Create an index for faster queries on repeating tasks
CREATE INDEX IF NOT EXISTS idx_tasks_repeat_rule ON tasks USING GIN (repeat_rule) WHERE repeat_rule IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN tasks.repeat_rule IS 'JSONB storing recurrence pattern: {type, interval, weekdays?, monthDay?, yearMonth?, yearDay?, endDate?, endCount?, originalText?}';
