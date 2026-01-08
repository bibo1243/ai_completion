-- Add dependencies column to tasks table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'dependencies') THEN
        ALTER TABLE tasks ADD COLUMN dependencies text[] DEFAULT '{}';
    END IF;
END $$;
