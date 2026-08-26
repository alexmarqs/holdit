"use client";

import type { HolderStanding } from "@holdit/core";
import { Download } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { useWall } from "@/components/wall-provider";
import { placeWall } from "./place-wall";
import { TileLayer } from "./tile-layer";
import {
  logoDataUrl,
  wallCaptureOptions,
  wallDownloadCaption,
  wallDownloadFilename,
} from "./wall-download";

const noopStanding = (_standing: HolderStanding) => {};
const noopFocus = (_standing: HolderStanding, _element: HTMLElement) => {};

/**
 * Photograph of the live wall — grout and real squares, no ghost, no Find dim
 * — with a census slip under it (day, live spend, square count).
 *
 * Captures an offscreen copy laid out at the on-screen size (live map never
 * flickers), then rasters at 3×. `opacity: 0` would photograph empty;
 * `display: none` / `visibility: hidden` are skipped by html-to-image. Park
 * it off to the left at opacity 1 instead.
 */
export function DownloadWallButton() {
  const state = useWall();
  const [pending, setPending] = useState(false);
  const empty = state.counters.squaresLive === 0;

  async function save() {
    const live = document.querySelector(".map-canvas");
    if (!(live instanceof HTMLElement)) return;
    const { width, height } = live.getBoundingClientRect();
    if (width < 1 || height < 1) return;

    setPending(true);
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: `${Math.round(width)}px`,
      opacity: "1",
      pointerEvents: "none",
    });
    document.body.appendChild(host);

    const canvas = { w: Math.round(width), h: Math.round(height) };
    const packed = placeWall(
      state.standings.map((s) => ({ id: s.holder.id, share: s.share })),
      canvas,
    );
    const byId = new Map(state.standings.map((s) => [s.holder.id, s]));
    const grout = getComputedStyle(live).backgroundColor;
    const paper = getComputedStyle(document.body).backgroundColor;
    const slip = wallDownloadCaption(state.generatedAt, state.counters);
    const root = createRoot(host);

    try {
      flushSync(() => {
        root.render(
          <div className="wall-print" style={{ width: canvas.w, backgroundColor: paper }}>
            <div
              className="map-canvas relative bg-map-grout"
              style={{ width: canvas.w, height: canvas.h, backgroundColor: grout }}
            >
              <TileLayer
                tiles={packed.tiles}
                byId={byId}
                canvas={canvas}
                needle=""
                flash={null}
                now={state.generatedAt}
                onEnter={noopStanding}
                onLeave={() => {}}
                onFocusTile={noopFocus}
              />
            </div>
            <p className="wall-print-caption">
              <strong>{slip.brand}</strong>
              <span>{slip.census}</span>
            </p>
          </div>,
        );
      });

      const node = host.querySelector(".wall-print");
      if (!(node instanceof HTMLElement)) return;
      await paintLogos(node);

      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(node, wallCaptureOptions(paper));
      if (!blob) return;

      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = wallDownloadFilename(state.generatedAt);
      link.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error("Wall download failed", error);
    } finally {
      root.unmount();
      host.remove();
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="h-8 w-8 px-0 lg:h-6 lg:w-auto lg:px-2"
      disabled={pending || empty}
      onClick={() => void save()}
      aria-label="Download the wall"
      title="Download the wall"
    >
      <Download />
      <span className="hidden lg:inline">{pending ? "Downloading" : "Download"}</span>
    </Button>
  );
}

function tileHandle(img: HTMLImageElement): string | null {
  return img.closest("[aria-label]")?.getAttribute("aria-label") ?? null;
}

async function paintLogos(root: ParentNode): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  if (imgs.length === 0) return;

  const handles = [...new Set(imgs.map(tileHandle).filter((h): h is string => h !== null))];
  const logos = await fetchLogoDataUrls(handles);

  for (const img of imgs) {
    const handle = tileHandle(img);
    if (!handle) continue;
    img.loading = "eager";
    img.src = logos[handle] ?? logoDataUrl(handle, null);
    img.removeAttribute("srcset");
  }

  await waitForImages(root);
}

async function fetchLogoDataUrls(handles: string[]): Promise<Record<string, string>> {
  if (handles.length === 0) return {};
  try {
    const response = await fetch("/api/favicons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handles }),
    });
    if (!response.ok) return {};
    const body = (await response.json()) as { logos?: Record<string, string> };
    return body.logos ?? {};
  } catch {
    return {};
  }
}

function waitForImages(root: ParentNode, ms = 1500): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  if (imgs.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    ).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}
