-- Migration: Add task comments and reactions tables
-- Created: 2026-01-30

-- Task Comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('host', 'guest')),
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Reactions table
CREATE TABLE IF NOT EXISTS task_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('host', 'guest')),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Unique constraint: one reaction per author_type per emoji per task
  UNIQUE(task_id, emoji, author_type)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reactions_task_id ON task_reactions(task_id);

-- Enable Row Level Security
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_comments
-- Allow anyone to read comments (for Guest access)
CREATE POLICY "Allow public read access to comments" ON task_comments
  FOR SELECT USING (true);

-- Allow anyone to insert comments (for Guest access)
CREATE POLICY "Allow public insert access to comments" ON task_comments
  FOR INSERT WITH CHECK (true);

-- Allow anyone to delete comments (controlled by app logic)
CREATE POLICY "Allow public delete access to comments" ON task_comments
  FOR DELETE USING (true);

-- RLS Policies for task_reactions
-- Allow anyone to read reactions
CREATE POLICY "Allow public read access to reactions" ON task_reactions
  FOR SELECT USING (true);

-- Allow anyone to insert reactions
CREATE POLICY "Allow public insert access to reactions" ON task_reactions
  FOR INSERT WITH CHECK (true);

-- Allow anyone to delete reactions
CREATE POLICY "Allow public delete access to reactions" ON task_reactions
  FOR DELETE USING (true);

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE task_reactions;
