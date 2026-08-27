"use client";

import { useAtom } from "jotai";
import { Search, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapSearchAtom } from "@/context/wall-atoms";
import { useWall } from "@/hooks/use-wall";
import { cn } from "@/lib/utils";
import { onSquareFocus } from "./focus-square";

export function MapSearch() {
  const { standings, counters } = useWall();
  const [query, setQuery] = useAtom(mapSearchAtom);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? standings.filter((s) => s.holder.handle.toLowerCase().includes(needle)).length
    : 0;

  useEffect(
    () =>
      onSquareFocus(window, (handle) => {
        setQuery(handle);
        document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }),
    [setQuery],
  );

  if (counters.squaresLive === 0) return null;

  return (
    <div className="relative min-w-42 w-full max-w-xl flex-1 sm:w-auto">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find a square"
        spellCheck={false}
        autoComplete="off"
        aria-label="Find a square"
        className={cn("h-8 w-full pl-9 text-sm", needle ? "pr-20" : "pr-3")}
      />
      {needle ? (
        <span className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
          <span className="num pointer-events-none px-1.5 text-[11px] text-muted-foreground">
            {matches}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 border-foreground/25 bg-muted text-foreground shadow-sm hover:bg-muted-foreground/15"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => setQuery("")}
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </Button>
        </span>
      ) : null}
    </div>
  );
}
