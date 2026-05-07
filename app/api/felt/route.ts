import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { feltRatelimit } from "@/lib/ratelimit";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

export async function POST(request: Request) {
  let body: { thought_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const thought_id = typeof body.thought_id === "string" ? body.thought_id : null;
  if (!thought_id || !UUID_REGEX.test(thought_id)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const { success } = await feltRatelimit.limit(getClientIp(request));
    if (!success) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  } catch (err) {
    console.error("[echoes:felt:POST] ratelimit failed, allowing:", err);
  }

  const { data, error: readError } = await supabase
    .from("thoughts")
    .select("felt_count")
    .eq("id", thought_id)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (readError || !data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("thoughts")
    .update({ felt_count: (data.felt_count ?? 0) + 1 })
    .eq("id", thought_id);

  if (updateError) {
    return NextResponse.json({ error: "could not update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
