import { classifyUserAgent, hashIp } from "@/lib/utils/hash";
import type { Database } from "../client";
import { visits } from "../schema";

export interface RecordVisitInput {
  ip: string;
  userAgent: string | null;
}

/**
 * Count a visitor.
 *
 * This is what makes the "visitors" and "online" figures real. It stores a
 * salted hash and a timestamp — enough to count distinct people and to say who
 * was here recently, and not enough to identify anybody.
 *
 * Crawlers are skipped. Counting them would inflate the very numbers the page
 * asks advertisers to trust, and there are a lot of them.
 *
 * Never throws: a page must still render if this write fails.
 */
export async function recordVisit(
  db: Database,
  input: RecordVisitInput,
  now = Date.now(),
): Promise<{ counted: boolean }> {
  if (classifyUserAgent(input.userAgent) !== "browser") return { counted: false };

  try {
    const at = new Date(now);
    await db
      .insert(visits)
      .values({ visitorHash: hashIp(input.ip), firstSeenAt: at, lastSeenAt: at })
      .onConflictDoUpdate({ target: visits.visitorHash, set: { lastSeenAt: at } });
    return { counted: true };
  } catch (error) {
    console.error("Visit not counted", error);
    return { counted: false };
  }
}
