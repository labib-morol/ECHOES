import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const { error } = await supabase
      .from("thoughts")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      console.error("[echoes:health] supabase error:", error);
      return NextResponse.json(
        { status: "degraded", timestamp, db: "error" },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "ok", timestamp, db: "connected" });
  } catch (err) {
    console.error("[echoes:health] unhandled exception:", err);
    return NextResponse.json(
      { status: "degraded", timestamp, db: "error" },
      { status: 503 }
    );
  }
}
