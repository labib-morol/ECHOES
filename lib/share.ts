"use client";

import { toBlob } from "html-to-image";

export interface ShareableThought {
  id: string;
  content: string;
  mood: string;
  mood_color: string;
}

const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;

function pickFontSize(len: number): number {
  if (len <= 80) return 64;
  if (len <= 200) return 52;
  if (len <= 500) return 38;
  if (len <= 1000) return 30;
  return 24;
}

function buildNode(thought: ShareableThought): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = [
    "position: fixed",
    "left: -10000px",
    "top: 0",
    `width: ${FRAME_WIDTH}px`,
    `height: ${FRAME_HEIGHT}px`,
    "background: radial-gradient(ellipse 75% 55% at 50% 42%, rgba(36,32,26,0.65) 0%, rgba(13,11,9,0) 65%), radial-gradient(ellipse 130% 110% at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.78) 100%), #0d0b09",
    "display: flex",
    "flex-direction: column",
    "justify-content: center",
    "align-items: center",
    "padding: 140px 110px 180px",
    "box-sizing: border-box",
    "overflow: hidden",
  ].join(";");

  const hairline = document.createElement("div");
  hairline.style.cssText = [
    "width: 64px",
    "height: 1px",
    `background: ${thought.mood_color}`,
    "opacity: 0.65",
    "margin-bottom: 64px",
  ].join(";");
  root.appendChild(hairline);

  const fontSize = pickFontSize(thought.content.length);
  const thoughtEl = document.createElement("p");
  thoughtEl.textContent = thought.content;
  thoughtEl.style.cssText = [
    "font-family: var(--font-playfair), 'Playfair Display', Georgia, serif",
    "font-style: italic",
    "font-weight: 400",
    `font-size: ${fontSize}px`,
    "color: #ece5d6",
    "text-align: center",
    "line-height: 1.45",
    "letter-spacing: -0.005em",
    "margin: 0",
    "max-width: 100%",
    "white-space: pre-wrap",
    "word-break: break-word",
    "text-shadow: 0 2px 6px rgba(0,0,0,0.55)",
  ].join(";");
  root.appendChild(thoughtEl);

  const moodEl = document.createElement("div");
  moodEl.textContent = thought.mood;
  moodEl.style.cssText = [
    "margin-top: 60px",
    "font-family: var(--font-syne), 'Syne', sans-serif",
    "font-weight: 300",
    "font-size: 18px",
    `color: ${thought.mood_color}`,
    "opacity: 0.6",
    "text-transform: uppercase",
    "letter-spacing: 0.32em",
  ].join(";");
  root.appendChild(moodEl);

  const watermark = document.createElement("div");
  watermark.textContent = "echoes.";
  watermark.style.cssText = [
    "position: absolute",
    "bottom: 90px",
    "left: 50%",
    "transform: translateX(-50%)",
    "font-family: var(--font-playfair), 'Playfair Display', Georgia, serif",
    "font-style: italic",
    "font-weight: 400",
    "font-size: 22px",
    "color: #5a544a",
    "letter-spacing: -0.01em",
  ].join(";");
  root.appendChild(watermark);

  return root;
}

export async function renderThoughtImage(thought: ShareableThought): Promise<Blob | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const node = buildNode(thought);
  document.body.appendChild(node);
  try {
    if (document.fonts && typeof document.fonts.ready?.then === "function") {
      await document.fonts.ready;
    }
    const blob = await toBlob(node, {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      pixelRatio: 1,
      backgroundColor: "#0d0b09",
      cacheBust: true,
    });
    return blob;
  } catch (err) {
    console.error("[echoes:share] render failed:", err);
    return null;
  } finally {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
}

export async function shareOrDownload(blob: Blob, filename = "echo.png"): Promise<"shared" | "downloaded" | "cancelled" | "failed"> {
  if (typeof window === "undefined") return "failed";

  try {
    const file = new File([blob], filename, { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    if (
      typeof nav.canShare === "function" &&
      typeof nav.share === "function" &&
      nav.canShare({ files: [file] })
    ) {
      try {
        await nav.share({ files: [file] });
        return "shared";
      } catch (err) {
        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        if (isAbort) return "cancelled";
      }
    }
  } catch {}

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return "downloaded";
  } catch (err) {
    console.error("[echoes:share] download failed:", err);
    return "failed";
  }
}
