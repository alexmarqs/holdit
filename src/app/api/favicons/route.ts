import { NextResponse } from "next/server";
import { z } from "zod";
import { logoDataUrl } from "@/components/map/wall-download";
import { externalWebsiteClient } from "@/lib/external-website-client";
import { faviconDomain, isFaviconDomain } from "@/lib/utils/favicon";
import { rateLimit } from "@/lib/utils/rate-limit";
import { clientIp } from "@/lib/utils/request";

const Body = z.object({
  handles: z.array(z.string().min(1).max(253)).max(200),
});

/**
 * Same-origin favicon bytes for a wall download. The live map hotlinks
 * Google; html-to-image cannot paint those because the host sends no CORS.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("favicon", clientIp(request), {
    limit: 10,
    windowSeconds: 60,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many favicon requests." }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ logos: {} });
  }

  const unique = [...new Set(parsed.data.handles)].filter((handle) =>
    isFaviconDomain(faviconDomain(handle)),
  );

  const logos: Record<string, string> = {};
  await Promise.all(
    unique.map(async (handle) => {
      const found = await externalWebsiteClient.fetchFavicon(handle, 128);
      logos[handle] = logoDataUrl(handle, found);
    }),
  );

  return NextResponse.json({ logos });
}
