"use client";

import { cn } from "@/lib/utils";

export function PreviewSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Purchase preview on the wall"
      title={on ? "Hide the dashed square" : "Show what this amount would buy"}
      onClick={onToggle}
      className={cn(
        "inline-flex h-6 cursor-pointer items-center gap-2 rounded-md px-1.5 text-xs font-semibold select-none hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        on ? "text-primary" : "text-muted-foreground",
      )}
    >
      Preview
      <span
        aria-hidden
        className={cn(
          "relative h-4.5 w-7.5 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-foreground/18",
        )}
      >
        <span
          className="absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform duration-150"
          style={{ transform: on ? "translateX(12px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
