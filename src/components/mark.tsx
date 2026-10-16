/**
 * The mark is the product: a frame subdivided into squares of unequal area,
 * the largest one filled. It is a treemap, drawn small.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="5.5" className="fill-primary" />
      <rect x="4.5" y="4.5" width="9.5" height="15" rx="1.6" className="fill-background" />
      <rect x="15.5" y="4.5" width="4" height="8" rx="1.6" className="fill-background/70" />
      <rect x="15.5" y="14" width="4" height="5.5" rx="1.6" className="fill-background/45" />
    </svg>
  );
}
