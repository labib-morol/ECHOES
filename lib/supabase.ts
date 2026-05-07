import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (typeof window === "undefined") {
  console.log(
    `[echoes:env] NEXT_PUBLIC_SUPABASE_URL: ${url ? "present" : "MISSING"}`
  );
  console.log(
    `[echoes:env] NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? "present" : "MISSING"}`
  );
}

export const supabase = createClient(url, anonKey);
