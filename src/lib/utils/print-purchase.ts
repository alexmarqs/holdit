/** Public print ids are purchase UUIDs, never a Stripe session or a timestamp. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePurchasePrintId(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  return UUID.test(raw) ? raw.toLowerCase() : null;
}
