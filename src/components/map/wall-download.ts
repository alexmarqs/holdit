import { monogram } from "@/lib/utils/domain";

/** PNG name for a photograph of the wall at `generatedAt`. Always UTC. */
export function wallDownloadFilename(generatedAt: number): string {
  return `holdit-${new Date(generatedAt).toISOString().slice(0, 10)}.png`;
}

export type FaviconBytes = { bytes: Uint8Array; contentType: string };

/**
 * html-to-image paints `<img>` into a canvas. Google's favicon host sends
 * CORP but no ACAO, so a hotlinked mark is visible on the live wall and
 * blank in the PNG — unless it is already a data URL.
 *
 * Never pass `imagePlaceholder`: that was a 1×1 GIF, which is how a
 * download of the wall lost every logo.
 */
export function wallCaptureOptions(backgroundColor: string) {
  return {
    backgroundColor,
    cacheBust: false,
    includeQueryParams: true,
    skipFonts: true,
    // Layout stays on-screen CSS size. 3× so Slack / X don't look soft.
    pixelRatio: 3,
  };
}

/** Favicon bytes, or a monogram so the square still has a mark. */
export function logoDataUrl(handle: string, found: FaviconBytes | null): string {
  if (found && found.bytes.byteLength >= 32) {
    return `data:${found.contentType};base64,${encodeBase64(found.bytes)}`;
  }
  return monogramDataUrl(handle);
}

function monogramDataUrl(handle: string): string {
  const letters = monogram(handle);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="24" fill="#0b9e96"/><text x="64" y="68" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="52" font-weight="700" font-family="system-ui,sans-serif">${letters}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function encodeBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
