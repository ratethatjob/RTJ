// The Vercel Supabase integration names its variables with an "rtj_" prefix;
// plain names work for local .env files.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_rtj_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

export const supabaseKey =
  process.env.NEXT_PUBLIC_rtj_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
