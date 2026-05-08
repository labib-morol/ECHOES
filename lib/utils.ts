type WallPosition = { position_x: number; position_y: number };

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

const PREVIEW_MAX = 110;
const PREVIEW_LOOKAHEAD = 140;
const PREVIEW_MIN_SENTENCE = 30;

export function getThoughtPreview(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= PREVIEW_MAX) return trimmed;

  const window = trimmed.slice(0, PREVIEW_LOOKAHEAD);
  const sentenceMatch = window.match(/[.!?\n]/);
  if (sentenceMatch && typeof sentenceMatch.index === "number") {
    const idx = sentenceMatch.index;
    if (idx >= PREVIEW_MIN_SENTENCE) {
      return trimmed.slice(0, idx + 1).trim();
    }
  }

  const cut = trimmed.slice(0, PREVIEW_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  const sliced = lastSpace > 60 ? cut.slice(0, lastSpace) : cut;
  return sliced.trim() + "…";
}

export function getCardWidth(content: string): number {
  const len = content.length;
  if (len <= 25) return 180;
  if (len <= 80) return 200;
  return 220;
}

export interface ThoughtTypography {
  fontSize: number;
  fontWeight: number;
  padding: string;
  centerVertically: boolean;
  minHeight: number;
  lineClamp: number;
  textAlign: "left" | "center";
  lineHeight: number;
}

export function getThoughtTypography(content: string): ThoughtTypography {
  const len = content.length;
  if (len <= 25) {
    return {
      fontSize: 18,
      fontWeight: 600,
      padding: "28px 20px",
      centerVertically: true,
      minHeight: 100,
      lineClamp: 3,
      textAlign: "center",
      lineHeight: 1.5,
    };
  }
  if (len <= 80) {
    return {
      fontSize: 14,
      fontWeight: 400,
      padding: "20px 18px 16px 18px",
      centerVertically: false,
      minHeight: 0,
      lineClamp: 4,
      textAlign: "left",
      lineHeight: 1.65,
    };
  }
  return {
    fontSize: 12,
    fontWeight: 400,
    padding: "20px 18px 16px 18px",
    centerVertically: false,
    minHeight: 0,
    lineClamp: 6,
    textAlign: "left",
    lineHeight: 1.8,
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
  existing: WallPosition[]
): { position_x: number; position_y: number; rotation: number; opacity_level: number } {
  const X_MIN = 4;
  const X_MAX = 76;
  const Y_MIN = 6;
  const Y_MAX = 92;
  const COLS = 5;
  const ROWS = 5;
  const cellW = (X_MAX - X_MIN) / COLS;
  const cellH = (Y_MAX - Y_MIN) / ROWS;

  let bestScore = -Infinity;
  let bestCells: { cx: number; cy: number }[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = X_MIN + cellW * (c + 0.5);
      const cy = Y_MIN + cellH * (r + 0.5);
      let minDist = Infinity;
      for (const t of existing) {
        const dx = t.position_x - cx;
        const dy = t.position_y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestScore) {
        bestScore = minDist;
        bestCells = [{ cx, cy }];
      } else if (minDist === bestScore) {
        bestCells.push({ cx, cy });
      }
    }
  }

  const chosen = bestCells.length > 0
    ? bestCells[Math.floor(Math.random() * bestCells.length)]
    : { cx: X_MIN + (X_MAX - X_MIN) / 2, cy: Y_MIN + (Y_MAX - Y_MIN) / 2 };

  const jitterX = cellW * 0.3;
  const jitterY = cellH * 0.3;
  const position_x = Math.max(
    X_MIN,
    Math.min(X_MAX, chosen.cx + (Math.random() - 0.5) * 2 * jitterX)
  );
  const position_y = Math.max(
    Y_MIN,
    Math.min(Y_MAX, chosen.cy + (Math.random() - 0.5) * 2 * jitterY)
  );

  const rotation = (Math.random() - 0.5) * 6;
  const opacity_level = 0.6 + Math.random() * 0.4;

  return { position_x, position_y, rotation, opacity_level };
}
