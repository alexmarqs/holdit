import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHead({ title, lede }: { title: string; lede: string }) {
  return (
    <header className="pt-6 pb-2">
      <h1 className="text-[28px] font-bold tracking-[-0.03em] text-pretty md:text-[36px]">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
        {lede}
      </p>
    </header>
  );
}

/** `wide` drops the reading measure for a table or a chart. */
export function Section({
  title,
  children,
  wide = false,
  id,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-[calc(var(--header-h)+12px)] border-t border-border py-7">
      <h2 className="text-sm font-bold">{title}</h2>
      <div
        className={cn(
          "mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground [&_b]:font-bold [&_b]:text-foreground [&_strong]:text-foreground",
          !wide && "max-w-[62ch]",
        )}
      >
        {children}
      </div>
    </section>
  );
}
