import { monogram } from "@/lib/utils/domain";
import { faviconDomain, isFaviconDomain, toFaviconProxyUrl } from "@/lib/utils/favicon";
import { formatInt, formatMoney, formatPrintDate } from "@/lib/utils/format";

/** PNG name for a photograph of the wall at `generatedAt`. Always UTC. */
export function wallDownloadFilename(generatedAt: number): string {
  return `holdit-${new Date(generatedAt).toISOString().slice(0, 10)}.png`;
}

/** Census line under a downloaded wall — the UTC instant, named as UTC. */
export function wallDownloadCaption(
  generatedAt: number,
  counters: { squaresLive: number; liveCents: number },
): { brand: string; census: string } {
  const squares =
    counters.squaresLive === 1 ? "1 square" : `${formatInt(counters.squaresLive)} squares`;
  return {
    brand: "holdit.lol",
    census: `${formatPrintDate(generatedAt)} · ${formatMoney(counters.liveCents)} live · ${squares}`,
  };
}

export type FaviconBytes = { bytes: Uint8Array; contentType: string };

/**
 * html-to-image paints `<img>` into a canvas. Google's favicon host sends
 * CORP but no ACAO, so a hotlinked mark is visible on the live wall and
 * blank in the PNG. Bytes come from `downloadLogoSrc` (same-origin GET the
 * CDN can hold). The photograph itself must already hold a data URL —
 * iOS Safari draws the clone through SVG foreignObject, which will not
 * paint an http(s) `<img>`, same-origin included. Chrome will. A data URL
 * is also the monogram when that GET has nothing.
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
    pixelRatio: 3,
  };
}

/**
 * Same-origin proxy for a real domain; monogram for anything we would not
 * fetch. Fetch this, then inline the bytes — do not leave it as `<img src>`
 * at snapshot time.
 */
export function downloadLogoSrc(handle: string): string {
  return isFaviconDomain(faviconDomain(handle))
    ? toFaviconProxyUrl(handle)
    : logoDataUrl(handle, null);
}

/**
 * Bytes for one mark, already a data URL, so Safari's photograph can paint it.
 * The GET is still how we fetch; the `<img>` has to hold data by the time we
 * snapshot. `fetchImpl` is for tests.
 */
export async function inlineDownloadLogo(
  handle: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const src = downloadLogoSrc(handle);
  if (src.startsWith("data:")) return src;
  try {
    const response = await fetchImpl(src, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return logoDataUrl(handle, null);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";
    return logoDataUrl(handle, { bytes, contentType });
  } catch {
    return logoDataUrl(handle, null);
  }
}

/** One GET per distinct handle so a wall of repeats still hits the CDN once. */
export async function inlineDownloadLogos(
  handles: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const unique = [...new Set(handles)];
  const entries = await Promise.all(
    unique.map(async (handle) => [handle, await inlineDownloadLogo(handle, fetchImpl)] as const),
  );
  return new Map(entries);
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
