import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (typeof window !== 'undefined' && window.VITE_SUPABASE_URL) ||
  import.meta.env?.VITE_SUPABASE_URL || 
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_SUPABASE_URL) || '';

const supabaseAnonKey = (typeof window !== 'undefined' && window.VITE_SUPABASE_ANON_KEY) ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY || 
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_SUPABASE_ANON_KEY) || '';

// Fallback to placeholders if missing to prevent module loading crashes
const finalUrl = (supabaseUrl && supabaseUrl.startsWith('https://')) ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey)