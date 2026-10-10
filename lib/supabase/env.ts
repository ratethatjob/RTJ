// Names set by the Supabase ↔ Vercel integration (optionally with a prefix
// such as "rtj_") or by a local .env file.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_rtj_SUPABASE_URL;

export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_rtj_SUPABASE_PUBLISHABLE_KEY;
