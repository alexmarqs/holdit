"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "The wall" },
  { href: "/rules", label: "Rules" },
] as const;

/**
 * Active item follows the official App Router pattern:
 * https://nextjs.org/docs/app/api-reference/file-conventions/layout#active-nav-links
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav>
      <ul className="flex items-center gap-4 text-sm sm:gap-5">
        {NAV.map((item) => {
          const active = pathname === item.href;
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
  );
}
