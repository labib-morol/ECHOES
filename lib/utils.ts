import type { Thought } from "@/lib/types";

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const MOOD_MAP: Record<string, string> = {
  heartbreak: "#c4687a",
  loneliness: "#6b8cad",
  anger: "#c47a3a",
  anxiety: "#9b7fc4",
  joy: "#7aad8c",
  life: "#a89b7a",
  random: "#888888",
};

const FALLBACK_PALETTE = [
  "#c4687a",
  "#6b8cad",
  "#c47a3a",
  "#9b7fc4",
  "#7aad8c",
  "#a89b7a",
  "#888888",
  "#7a9cad",
  "#ad7a8c",
  "#8cad7a",
  "#c4a86a",
  "#7a8cad",
];

function randomFromAlphabet(length: number): string {
  let out = "";
  const max = KEY_ALPHABET.length;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      out += KEY_ALPHABET[buf[i] % max];
    }
  } else {
    for (let i = 0; i < length; i++) {
      out += KEY_ALPHABET[Math.floor(Math.random() * max)];
    }
  }
  return out;
}

export function generateKey(): string {
  return `ECHO-${randomFromAlphabet(4)}-${randomFromAlphabet(4)}`;
}

export async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function getArchiveNumber(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 1000;
  return num.toString().padStart(3, "0");
}

export function getCardWidth(content: string): number {
  const len = content.length;
  if (len < 60) return 150;
  if (len < 160) return 180;
  return 210;
}

export interface ThoughtTypography {
  fontSize: number;
  fontWeight: number;
  padding: string;
  centerVertically: boolean;
  minHeight: number;
  lineClamp: number;
}

export function getThoughtTypography(content: string): ThoughtTypography {
  const len = content.length;
  if (len <= 30) {
    return {
      fontSize: 16,
      fontWeight: 700,
      padding: "24px 18px 22px 18px",
      centerVertically: true,
      minHeight: 100,
      lineClamp: 3,
    };
  }
  if (len <= 60) {
    return {
      fontSize: 14,
      fontWeight: 400,
      padding: "20px 18px 16px 18px",
      centerVertically: false,
      minHeight: 0,
      lineClamp: 3,
    };
  }
  if (len > 120) {
    return {
      fontSize: 12,
      fontWeight: 400,
      padding: "20px 18px 16px 18px",
      centerVertically: false,
      minHeight: 0,
      lineClamp: 5,
    };
  }
  return {
    fontSize: 13,
    fontWeight: 400,
    padding: "20px 18px 16px 18px",
    centerVertically: false,
    minHeight: 0,
    lineClamp: 4,
  };
}

export function hexToRgb(hex: string): string {
  const cleaned = hex.replace("#", "");
  const value = cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const value = cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getMoodColor(mood: string): string {
  const normalized = mood.trim().toLowerCase();
  if (MOOD_MAP[normalized]) return MOOD_MAP[normalized];

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[index];
}

export function assignPositions(
  existingThoughts: Thought[]
): { position_x: number; position_y: number; rotation: number; opacity_level: number } {
  const MIN_DISTANCE = 12;
  const MAX_ATTEMPTS = 60;

  let position_x = 0;
  let position_y = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    position_x = 5 + Math.random() * 80;
    position_y = 5 + Math.random() * 80;

    let collides = false;
    for (const t of existingThoughts) {
      const dx = t.position_x - position_x;
      const dy = t.position_y - position_y;
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DISTANCE) {
        collides = true;
        break;
      }
    }
    if (!collides) break;
  }

  const rotation = Math.random() * 12 - 6;
  const opacity_level = 0.6 + Math.random() * 0.4;

  return { position_x, position_y, rotation, opacity_level };
}
