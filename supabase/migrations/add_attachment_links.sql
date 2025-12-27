-- Add attachment_links column to tasks table
-- This column stores the relationships between paragraphs and attachments

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS attachment_links JSONB DEFAULT '[]'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_attachment_links ON tasks USING GIN (attachment_links);

-- Add comment to document the column
COMMENT ON COLUMN tasks.attachment_links IS 'Array of objects linking paragraph IDs to attachment URLs for presentation mode';
