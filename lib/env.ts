const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "GROQ_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

let hasChecked = false;

export function checkEnv(): { ok: boolean; missing: string[] } {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (!hasChecked) {
    hasChecked = true;
    if (missing.length > 0) {
      console.error(
        `[echoes:env] missing required environment variables: ${missing.join(", ")}`
      );
    }
  }

  return { ok: missing.length === 0, missing };
}
