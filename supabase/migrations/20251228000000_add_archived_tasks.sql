-- Create archived_tasks table to store archived tasks separately
-- This reduces the main tasks table size and improves performance

CREATE TABLE IF NOT EXISTS archived_tasks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT,
    status TEXT NOT NULL DEFAULT 'logged',
    original_parent_id UUID,  -- Store original parent_id for potential restoration
    parent_id UUID,           -- Current parent_id (may be null if parent not archived yet)
    is_project BOOLEAN DEFAULT FALSE,
    order_index DOUBLE PRECISION DEFAULT 0,
    view_orders JSONB DEFAULT '{}',
    tags UUID[] DEFAULT '{}',
    color TEXT DEFAULT 'blue',
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    images TEXT[] DEFAULT '{}',
    attachments TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS archived_tasks_user_id_idx ON archived_tasks(user_id);
CREATE INDEX IF NOT EXISTS archived_tasks_original_parent_id_idx ON archived_tasks(original_parent_id);

-- Enable RLS
ALTER TABLE archived_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own archived tasks"
    ON archived_tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own archived tasks"
    ON archived_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own archived tasks"
    ON archived_tasks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own archived tasks"
    ON archived_tasks FOR DELETE
    USING (auth.uid() = user_id);
