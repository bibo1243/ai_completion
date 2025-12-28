-- Add ai_history column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS ai_history JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN tasks.ai_history IS 'Array of AI interaction history: [{ id, role, content, prompt, created_at }]';
