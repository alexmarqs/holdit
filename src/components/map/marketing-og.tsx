import { ImageResponse } from "next/og";
import { loadOgFonts, OG_SCALE, OG_SIZE, px } from "./og-fonts";

function Mark({ size }: { size: number }) {
  const s = size / 24;
  const r = (n: number) => n * s;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        background: "#0b9e96",
        borderRadius: r(5.5),
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: r(4.5),
          top: r(4.5),
          width: r(9.5),
          height: r(15),
          background: "#fafcfc",
          borderRadius: r(1.6),
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: r(15.5),
          top: r(4.5),
          width: r(4),
          height: r(8),
          background: "rgba(250,252,252,0.72)",
          borderRadius: r(1.6),
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: r(15.5),
          top: r(14),
          width: r(4),
          height: r(5.5),
          background: "rgba(250,252,252,0.46)",
          borderRadius: r(1.6),
        }}
      />
    </div>
  );
}

/**
 * The default share card. A poster for the product, not a screenshot of the
 * live wall — the print URL is what freezes the map.
 */
export async function marketingOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#f4f8f8",
        fontFamily: "DM Sans",
        color: "#14201f",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: px(720),
          height: "100%",
          padding: `${px(64)}px ${px(72)}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <Mark size={px(36)} />
          <div
            style={{
              display: "flex",
              marginLeft: px(14),
              fontSize: px(28),
              fontWeight: 700,
              letterSpacing: -1.1 * OG_SCALE,
            }}
          >
            holdit.lol
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: px(64),
              fontWeight: 700,
              letterSpacing: -2.4 * OG_SCALE,
              lineHeight: 1.05,
            }}
          >
            Hold your square of the wall.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: px(22),
              fontSize: px(26),
              color: "#5f6f6d",
              lineHeight: 1.35,
            }}
          >
            Everyone paying for attention, sized by how much they're paying. No auction.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: px(22),
            fontWeight: 700,
            color: "#0b9e96",
            letterSpacing: -0.4 * OG_SCALE,
          }}
        >
          From $1 · Hold it
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          background: "#e7efee",
        }}
      >
        <Mark size={px(220)} />
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadOgFonts() },
  );
}
