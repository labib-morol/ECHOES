import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY ?? "";

if (typeof window === "undefined") {
  console.log(`[echoes:env] GROQ_API_KEY: ${apiKey ? "present" : "MISSING"}`);
}

export const groq = new Groq({ apiKey });

const MODEL = "llama-3.1-8b-instant";

const MOOD_SYSTEM_PROMPT =
  "You are a mood detector for anonymous emotional thoughts posted by young people aged 14-28. Analyze the thought and return ONLY a valid JSON object with exactly two fields: mood (a single lowercase word or short 2-3 word phrase that captures the specific emotional tone — be creative and specific, examples: 'heartbreak', 'late night thoughts', 'missing someone', 'existential dread', 'tired of it all', 'small joy', 'numb', 'longing', 'silent anger' — never use generic words like 'sad' or 'happy') and color (a muted, desaturated hex color that emotionally fits this mood — keep saturation under 55%, avoid bright or neon colors). Return only the JSON, no explanation, no markdown.";

const MODERATION_SYSTEM_PROMPT = `You are a content moderator for an anonymous emotional thoughts wall used by young people aged 14-28. Classify a single thought and return ONLY a valid JSON object with two fields: action (one of "allow", "block", "crisis") and reason (a very short string).

Rules:
- "block": spam, advertising, promotional content, links/handles meant to drive traffic, hate speech, slurs, racial / sexual / identity-based attacks, or threats of violence against others.
- "crisis": clear signs of self-harm, suicidal ideation, or immediate danger to the author themselves.
- "allow": everything else. Dark emotional venting, sadness, despair, hopelessness, anger at the world, grief, numbness, hatred of one's own life — ALL of this is the entire point of this platform and must always be allowed.

Return only the JSON object, no markdown, no explanation.`;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export async function detectMood(content: string): Promise<{ mood: string; color: string }> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MOOD_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error("empty response");

    const parsed = JSON.parse(raw) as { mood?: unknown; color?: unknown };
    const mood = typeof parsed.mood === "string" && parsed.mood.trim().length > 0
      ? parsed.mood.trim().toLowerCase()
      : null;
    const color = isHexColor(parsed.color) ? parsed.color.toLowerCase() : null;

    if (!mood || !color) throw new Error("invalid mood payload");
    return { mood, color };
  } catch (err) {
    console.error("[echoes:groq] detectMood failed, falling back to untagged:", err);
    return { mood: "untagged", color: "#888888" };
  }
}

export async function moderateContent(
  content: string
): Promise<{ action: "allow" | "block" | "crisis"; reason?: string }> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MODERATION_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error("empty response");

    const parsed = JSON.parse(raw) as { action?: unknown; reason?: unknown };
    const action = parsed.action;
    if (action === "block" || action === "crisis" || action === "allow") {
      const reason = typeof parsed.reason === "string" ? parsed.reason : undefined;
      return { action, reason };
    }
    throw new Error("invalid action");
  } catch (err) {
    console.error("[echoes:groq] moderateContent failed, defaulting to allow:", err);
    return { action: "allow" };
  }
}
