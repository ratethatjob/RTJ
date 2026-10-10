import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

const secretKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.rtj_SUPABASE_SERVICE_ROLE_KEY;

/** Service-role client for background jobs (translations). Null when not configured. */
export function adminClient() {
  if (!supabaseUrl || !secretKey) return null;
  return createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
}
