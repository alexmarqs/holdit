import { ImageResponse } from "next/og";
import { externalWebsiteClient } from "@/lib/external-website-client";
import { monogram } from "@/lib/utils/domain";
import { faviconDomain } from "@/lib/utils/favicon";
import { loadOgFonts, OG_SCALE, px } from "./og-fonts";
import { CARD_TILE_PAD_X, CARD_TILE_PAD_Y, cardPalette, type WallCard } from "./wall-card";

const MAX_LOGO_FETCHES = 160;

export async function resolveCardLogos(card: WallCard): Promise<WallCard> {
  const order = [...card.tiles]
    .map((tile, index) => ({ index, area: tile.w * tile.h }))
    .sort((a, b) => b.area - a.area)
    .slice(0, MAX_LOGO_FETCHES);
  const allowed = new Set(order.map((row) => row.index));

  const tiles = await Promise.all(
    card.tiles.map(async (tile, index) => {
      if (!tile.logoUrl) return tile;
      if (!allowed.has(index)) return { ...tile, logoUrl: null };

      const found = await externalWebsiteClient.fetchFavicon(faviconDomain(tile.handle), 128);
      return {
        ...tile,
        logoUrl: found
          ? `data:${found.contentType};base64,${Buffer.from(found.bytes).toString("base64")}`
          : null,
      };
    }),
  );
  return { ...card, tiles };
}

function HolditMark() {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: px(28),
        height: px(28),
        background: "#0b9e96",
        borderRadius: px(7),
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: px(4),
          top: px(4),
          width: px(12),
          height: px(19),
          background: "#fafcfc",
          borderRadius: px(2),
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: px(18),
          top: px(4),
          width: px(6),
          height: px(10),
          background: "rgba(250,252,252,0.72)",
          borderRadius: px(2),
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: px(18),
          top: px(16),
          width: px(6),
          height: px(8),
          background: "rgba(250,252,252,0.46)",
          borderRadius: px(2),
        }}
      />
    </div>
  );
}

function TileMark({ src, handle, size }: { src: string | null; handle: string; size: number }) {
  const pxSize = px(size);
  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: ImageResponse has no next/image
      <img
        src={src}
        width={pxSize}
        height={pxSize}
        alt=""
        style={{ width: pxSize, height: pxSize, borderRadius: px(6), objectFit: "contain" }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: pxSize,
        height: pxSize,
        borderRadius: px(6),
        background: "#0b9e96",
        color: "#ffffff",
        fontSize: px(Math.max(10, Math.round(size * 0.42))),
        fontWeight: 700,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {monogram(handle)}
    </div>
  );
}

/** The card X unfurls and the download button saves. */
export async function wallOgImage(card: WallCard) {
  const skin = cardPalette(card.theme);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: skin.page,
        fontFamily: "DM Sans",
        color: skin.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: px(card.header),
          padding: `0 ${px(40)}px`,
        }}
      >
        <HolditMark />
        <div
          style={{
            display: "flex",
            marginLeft: px(12),
            fontSize: px(32),
            fontWeight: 700,
            letterSpacing: -1.2 * OG_SCALE,
          }}
        >
          holdit.lol
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            marginLeft: "auto",
          }}
        >
          <div style={{ display: "flex", fontSize: px(22), color: skin.muted }}>{card.stats}</div>
          <div style={{ display: "flex", marginTop: px(4), fontSize: px(18), color: skin.muted }}>
            {card.date}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          position: "relative",
          width: px(card.map.w),
          height: px(card.map.h),
        }}
      >
        {card.tiles.map((tile) => {
          const named = tile.name !== null;
          const tiny = !named && !tile.spine;

          /*
           * Every tile is one absolutely-positioned box holding one explicit
           * column. Satori does not flatten React fragments into a flex
           * container's children the way a browser does, so the previous
           * fragment-wrapped logo/name/stats were laid out as a single row —
           * which is why the download read "linear.app10.0% · 77" with the
           * stats running off the edge while the screen stacked them.
           */
          return (
            <div
              key={tile.id}
              style={{
                position: "absolute",
                left: px(tile.x),
                top: px(tile.y),
                width: px(tile.w),
                height: px(tile.h),
                display: "flex",
                flexDirection: "column",
                alignItems: tile.spine || tiny ? "center" : "flex-start",
                justifyContent: tiny ? "center" : "flex-start",
                padding: tiny ? 0 : `${px(CARD_TILE_PAD_Y)}px ${px(CARD_TILE_PAD_X)}px`,
                background: tile.color,
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", marginBottom: named || tile.spine ? px(6) : 0 }}>
                <TileMark src={tile.logoUrl} handle={tile.handle} size={tile.logoPx} />
              </div>

              {tile.spine ? (
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    minHeight: 0,
                    fontSize: px(11),
                    fontWeight: 700,
                    letterSpacing: -0.4 * OG_SCALE,
                    writingMode: "vertical-rl",
                    overflow: "hidden",
                  }}
                >
                  {tile.name}
                </div>
              ) : null}

              {named && !tile.spine ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: px(tile.nameFontPx),
                    fontWeight: 700,
                    letterSpacing: -0.02 * tile.nameFontPx * OG_SCALE,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    maxWidth: "100%",
                  }}
                >
                  {tile.name}
                </div>
              ) : null}

              {named && !tile.spine && tile.showStats ? (
                <div
                  style={{
                    display: "flex",
                    marginTop: px(2),
                    fontSize: px(12),
                    lineHeight: 1.3,
                    color: skin.tileInk,
                    opacity: 0.62,
                    // Wraps rather than clips, because the live tile wraps: a
                    // narrow square shows "1.9% · 1,333" then "clicks", and
                    // nowrap turned that into "1.9% · 1,333 clic".
                    maxWidth: px(tile.w - CARD_TILE_PAD_X * 2),
                  }}
                >
                  {tile.meta}
                </div>
              ) : null}

              {named && !tile.spine && tile.tagline ? (
                <div
                  style={{
                    display: "flex",
                    marginTop: px(8),
                    fontSize: px(12),
                    lineHeight: 1.35,
                    color: skin.tileInk,
                    opacity: 0.62,
                    maxWidth: px(Math.min(tile.w - CARD_TILE_PAD_X * 2, 300)),
                  }}
                >
                  {tile.tagline}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>,
    {
      width: px(card.size.width),
      height: px(card.size.height),
      fonts: await loadOgFonts(),
    },
  );
}
