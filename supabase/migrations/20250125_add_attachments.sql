-- Add attachments column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add comment to describe the column
COMMENT ON COLUMN tasks.attachments IS 'Array of file attachments with metadata: [{ name, url, size, type }]';
