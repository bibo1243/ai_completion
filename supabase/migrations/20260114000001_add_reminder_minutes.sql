-- Add reminder_minutes column to tasks table for in-app reminders
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN tasks.reminder_minutes IS 'Minutes before start_date/due_date to trigger a reminder notification. NULL means no reminder.';
