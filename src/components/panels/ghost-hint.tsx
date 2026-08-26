import { Shantell_Sans } from "next/font/google";

const note = Shantell_Sans({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

const copy = (
  <>
    the dashed square
    <br />
    below is you
  </>
);

function DownArrow({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 32" className={className} fill="none">
      <title>Arrow toward the dashed square</title>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path
          className="ghost-hint-shaft"
          d="M12 3 C 12 12, 12 20, 12 26"
          opacity="0.28"
          transform="translate(0.45 0.4)"
        />
        <path className="ghost-hint-shaft" d="M12 3 C 12 12, 12 20, 12 26" />
        <path className="ghost-hint-head" d="M7 21 L12 27 L17 21" />
      </g>
    </svg>
  );
}

/**
 * Handwritten note that names the dashed preview.
 *
 * `hold` sits in the leftover gutter left of the Hold chip (`lg+`). The
 * arrow points at the note, from the chip. Below `lg`, `map` sits under the
 * form and points down at the wall so the note is never clipped.
 */
export function GhostHint({ placement }: { placement: "hold" | "map" }) {
  if (placement === "map") {
    return (
      <aside
        aria-hidden
        className="pointer-events-none mt-3 flex flex-col items-center gap-0.5 lg:hidden"
      >
        <p
          className={`${note.className} rotate-[-3deg] text-center text-[13px] leading-[1.1] text-primary/90`}
        >
          {copy}
        </p>
        <DownArrow className="h-7 w-5 overflow-visible text-primary/90" />
      </aside>
    );
  }

  return (
    <aside
      aria-hidden
      className="pointer-events-none absolute top-1/2 right-full mr-1 hidden -translate-y-1/2 items-center gap-1.5 lg:flex"
    >
      <p
        className={`${note.className} w-35 origin-right rotate-[-4deg] text-right text-[15px] leading-[1.05] text-primary/90`}
      >
        {copy}
      </p>
      <svg
        viewBox="0 0 46 38"
        className="h-9.5 w-11.5 shrink-0 overflow-visible text-primary/90"
        fill="none"
      >
        <title>Arrow from Hold toward the note</title>
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
          <path
            className="ghost-hint-shaft"
            d="M42 19 C 31 18, 15 18, 3 19"
            opacity="0.28"
            transform="translate(-0.55 0.45)"
          />
          <path className="ghost-hint-shaft" d="M42 19 C 31 18, 15 18, 3 19" />
          <path className="ghost-hint-head" d="M10 13 L3 19 L10 25" />
        </g>
      </svg>
    </aside>
  );
}
