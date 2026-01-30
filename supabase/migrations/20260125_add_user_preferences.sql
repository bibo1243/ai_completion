-- Migration: Add user_preferences table for cross-browser/device preference sync
-- This stores user preferences that should persist across browsers and devices

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    preference_key text NOT NULL,
    preference_value jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT user_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT user_preferences_user_key UNIQUE (user_id, preference_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own preferences" 
ON public.user_preferences FOR SELECT 
USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Users can insert their own preferences" 
ON public.user_preferences FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Users can update their own preferences" 
ON public.user_preferences FOR UPDATE 
USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Users can delete their own preferences" 
ON public.user_preferences FOR DELETE 
USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;

-- Add comment for documentation
COMMENT ON TABLE public.user_preferences IS 'Stores user preferences that sync across browsers/devices. Keys include: viewTagFilters, heartViewState, etc.';
