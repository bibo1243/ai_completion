import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase Config:', { 
  url: supabaseUrl, 
  keyLength: supabaseAnonKey?.length 
});

let client = null;

if (supabaseUrl && supabaseAnonKey) {
    try {
        client = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
        console.error('Error creating Supabase client:', error);
    }
} else {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.')
}

export const supabase = client;
