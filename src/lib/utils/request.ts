export const clientIp = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "0.0.0.0";
};

export function referrerOf(request: Request): string | null {
  const referrer = request.headers.get("referer");
  if (!referrer) return null;
  return referrer.slice(0, 512);
}
