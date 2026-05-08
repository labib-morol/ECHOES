import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { detectMood, moderateContent } from "@/lib/groq";
import { generateKey, hashKey, assignPositions } from "@/lib/utils";
import { thoughtRatelimit } from "@/lib/ratelimit";

const PUBLIC_COLUMNS =
  "id, content, mood, mood_color, is_crisis, created_at, expires_at, position_x, position_y, rotation, opacity_level";

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("thoughts")
      .select(PUBLIC_COLUMNS)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      console.error("[echoes:thoughts:GET] supabase select error:", error);
      return NextResponse.json({ error: "could not load the wall" }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[echoes:thoughts:GET] unhandled exception:", err);
    return NextResponse.json({ error: "could not load the wall" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: { content?: unknown };
    try {
      body = await request.json();
    } catch (err) {
      console.error("[echoes:thoughts:POST] invalid JSON body:", err);
      return NextResponse.json({ error: "this thought couldn't be released" }, { status: 400 });
    }

    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "this thought couldn't be released" }, { status: 400 });
    }

    const content = body.content.trim();
    if (content.length < 3 || content.length > 2000) {
      console.error(
        `[echoes:thoughts:POST] content length out of range: ${content.length}`
      );
      return NextResponse.json({ error: "this thought couldn't be released" }, { status: 400 });
    }

    try {
      const { success } = await thoughtRatelimit.limit(getClientIp(request));
      if (!success) {
        return NextResponse.json(
          { error: "the wall is resting. try again soon." },
          { status: 429 }
        );
      }
    } catch (err) {
      console.error("[echoes:thoughts:POST] ratelimit failed, allowing:", err);
    }

    let moderation: { action: "allow" | "block" | "crisis"; reason?: string };
    try {
      moderation = await moderateContent(content);
    } catch (err) {
      console.error(
        "[echoes:thoughts:POST] moderation threw outside fallback, allowing:",
        err
      );
      moderation = { action: "allow" };
    }

    if (moderation.action === "block") {
      return NextResponse.json({ error: "this thought couldn't be released" }, { status: 400 });
    }
    const is_crisis = moderation.action === "crisis";

    let mood = "untagged";
    let mood_color = "#888888";
    try {
      const result = await detectMood(content);
      mood = result.mood;
      mood_color = result.color;
    } catch (err) {
      console.error(
        "[echoes:thoughts:POST] detectMood threw outside fallback, using defaults:",
        err
      );
    }

    let existingPositions: { position_x: number; position_y: number }[] = [];
    try {
      const { data: positions, error: posError } = await supabase
        .from("thoughts")
        .select("position_x, position_y")
        .gt("expires_at", new Date().toISOString());
      if (!posError && Array.isArray(positions)) {
        existingPositions = positions as { position_x: number; position_y: number }[];
      }
    } catch (err) {
      console.error("[echoes:thoughts:POST] could not read positions, placing blind:", err);
    }

    const { position_x, position_y, rotation, opacity_level } = assignPositions(existingPositions);

    const key = generateKey();

    let key_hash: string;
    try {
      key_hash = await hashKey(key);
    } catch (err) {
      console.error("[echoes:thoughts:POST] hashKey failed:", err);
      return NextResponse.json({ error: "this thought couldn't be released" }, { status: 500 });
    }

    const insertPayload = {
      content,
      mood,
      mood_color,
      key_hash,
      is_crisis,
      position_x,
      position_y,
      rotation,
      opacity_level,
    };

    const { data: inserted, error } = await supabase
      .from("thoughts")
      .insert(insertPayload)
      .select(PUBLIC_COLUMNS)
      .single();

    if (error) {
      console.error("[echoes:thoughts:POST] supabase insert error:", error);
      return NextResponse.json({ error: "this thought couldn't be released" }, { status: 500 });
    }

    if (!inserted) {
      console.error("[echoes:thoughts:POST] supabase insert returned no row");
      return NextResponse.json({ error: "this thought couldn't be released" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      key,
      mood,
      mood_color,
      is_crisis,
      thought: inserted,
    });
  } catch (err) {
    console.error("[echoes:thoughts:POST] unhandled exception:", err);
    return NextResponse.json({ error: "this thought couldn't be released" }, { status: 500 });
  }
}
