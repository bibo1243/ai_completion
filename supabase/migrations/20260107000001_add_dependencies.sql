-- Add dependencies column to tasks table
ALTER TABLE tasks ADD COLUMN dependencies text[] DEFAULT '{}';
