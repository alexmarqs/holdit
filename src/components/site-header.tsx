"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "The wall" },
  { href: "/rules", label: "Rules" },
] as const;

export function SiteHeader() {
  const path = usePathname();

  return (
    <header className="h-[var(--header-h)] w-full border-b border-border/70">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <Mark className="size-6" />
          <span className="text-[19px] leading-none font-semibold tracking-[-0.03em]">
            holdit<span className="font-normal text-muted-foreground">.lol</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <nav>
            <ul className="flex items-center gap-4 text-sm sm:gap-5">
              {NAV.map((item) => {
                const active = path === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-6 items-center transition-colors",
                        active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
