-- Create reminders table for cross-device sync
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    task_title TEXT NOT NULL,
    task_color TEXT DEFAULT 'gray',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_time TIMESTAMPTZ NOT NULL,
    seen BOOLEAN DEFAULT FALSE,
    snoozed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_task_id ON reminders(task_id);

-- Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own reminders"
    ON reminders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminders"
    ON reminders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
    ON reminders FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
    ON reminders FOR DELETE
    USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;

-- Create triggered_signatures table for tracking which reminders have been triggered
CREATE TABLE IF NOT EXISTS reminder_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

-- Enable RLS for signatures
ALTER TABLE reminder_signatures ENABLE ROW LEVEL SECURITY;

-- RLS policies for signatures
CREATE POLICY "Users can view their own signatures"
    ON reminder_signatures FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own signatures"
    ON reminder_signatures FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own signatures"
    ON reminder_signatures FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signatures"
    ON reminder_signatures FOR DELETE
    USING (auth.uid() = user_id);

-- Enable realtime for signatures
ALTER PUBLICATION supabase_realtime ADD TABLE reminder_signatures;
