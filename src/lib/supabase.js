import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (typeof window !== 'undefined' && window.VITE_SUPABASE_URL) ||
  import.meta.env?.VITE_SUPABASE_URL || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';

const supabaseAnonKey = (typeof window !== 'undefined' && window.VITE_SUPABASE_ANON_KEY) ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)