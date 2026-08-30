import Link from "next/link";
import { Suspense } from "react";
import { Mark } from "@/components/mark";
import { SiteNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="h-[var(--header-h)] w-full border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <Mark className="size-6" />
          <span className="text-[19px] leading-none font-semibold tracking-[-0.03em]">
            holdit<span className="font-normal text-muted-foreground">.lol</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <Suspense>
            <SiteNav />
          </Suspense>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
