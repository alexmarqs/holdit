"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "The wall" },
  { href: "/rules", label: "Rules" },
] as const;

export function SiteNav() {
  const path = usePathname();

  return (
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
  );
}
