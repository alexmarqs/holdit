import Link from "next/link";
import { Mark } from "@/components/mark";

const FOOTER_LINKS = [
  { href: "/rules", label: "Rules" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-border bg-card">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <Link href="/" className="inline-flex items-center gap-2">
            <Mark className="size-6" />
            <span className="text-[18px] leading-none font-semibold tracking-[-0.03em]">
              holdit<span className="font-normal text-muted-foreground">.lol</span>
            </span>
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Hold a square on a wall of everyone paying for attention, sized by spend. No auction, no
            bidding, no leaderboard to climb.
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            Built by{" "}
            <a
              href="https://www.twitter.com/alexlmarques"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              @alexlmarques
            </a>
            {" // "}
            {FOOTER_LINKS.map((item, idx) => (
              <span key={item.href}>
                {idx > 0 && <span className="px-1.5">•</span>}
                <Link
                  href={item.href}
                  className="inline-flex min-h-6 items-center text-primary transition-colors hover:text-primary/80"
                >
                  {item.label}
                </Link>
              </span>
            ))}
            <span className="px-1.5">•</span>
            <a
              href="https://github.com/alexmarqs/holdit.lol"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 items-center text-primary transition-colors hover:text-primary/80"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
