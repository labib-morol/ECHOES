import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { hashKey } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    let body: { key?: unknown };
    try {
      body = await request.json();
    } catch (err) {
      console.error("[echoes:key:POST] invalid JSON body:", err);
      return NextResponse.json([]);
    }

    const raw = typeof body.key === "string" ? body.key.trim() : "";
    if (!raw) {
      return NextResponse.json([]);
    }

    const normalized = raw.toUpperCase();
    if (!/^ECHO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
      return NextResponse.json([]);
    }

    let key_hash: string;
    try {
      key_hash = await hashKey(normalized);
    } catch (err) {
      console.error("[echoes:key:POST] hashKey failed:", err);
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("thoughts")
      .select("id, felt_count")
      .eq("key_hash", key_hash)
      .gt("expires_at", new Date().toISOString());

    if (error) {
      console.error("[echoes:key:POST] supabase select error:", error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[echoes:key:POST] unhandled exception:", err);
    return NextResponse.json([]);
  }
}
