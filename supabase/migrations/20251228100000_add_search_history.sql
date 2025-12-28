-- Create search_history table to store saved searches
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query TEXT NOT NULL DEFAULT '',
    filters JSONB DEFAULT '{}',  -- Stores tag filters, date range, color filters
    name TEXT,  -- Optional custom name for saved search
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS search_history_user_id_idx ON search_history(user_id);
CREATE INDEX IF NOT EXISTS search_history_created_at_idx ON search_history(created_at DESC);

-- Enable RLS
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own search history"
    ON search_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search history"
    ON search_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search history"
    ON search_history FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search history"
    ON search_history FOR DELETE
    USING (auth.uid() = user_id);
