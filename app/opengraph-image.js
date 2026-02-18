import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size    = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function og() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0d0d0f",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          fontFamily: "Arial Black, Impact, sans-serif",
        }}
      >
        {/* Gold border inset */}
        <div
          style={{
            position: "absolute",
            inset: 24,
            border: "2px solid rgba(245,197,24,0.3)",
            borderRadius: 24,
            display: "flex",
          }}
        />

        {/* Corner logo mark — top left */}
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 60,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 900, color: "#f5c518", letterSpacing: "-1px" }}>YS</span>
          <div style={{ width: 28, height: 1, background: "rgba(245,197,24,0.4)", margin: "3px 0", display: "flex" }} />
          <span style={{ fontSize: 28, fontWeight: 900, color: "#ffdd6e", letterSpacing: "-1px" }}>AT</span>
        </div>

        {/* URL — top right */}
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 60,
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(245,197,24,0.5)",
            letterSpacing: "0.04em",
            fontFamily: "Arial, sans-serif",
            display: "flex",
          }}
        >
          yousureaboutthat.app
        </div>

        {/* Main title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
            <span style={{ fontSize: 112, fontWeight: 900, color: "#f0ede8", letterSpacing: "-2px", lineHeight: 1 }}>YOU</span>
            <span style={{ fontSize: 112, fontWeight: 900, color: "#f5c518", letterSpacing: "-2px", lineHeight: 1 }}>SURE</span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
            <span style={{ fontSize: 112, fontWeight: 900, color: "#f0ede8", letterSpacing: "-2px", lineHeight: 1 }}>ABOUT</span>
            <span style={{ fontSize: 112, fontWeight: 900, color: "#ffdd6e", letterSpacing: "-2px", lineHeight: 1 }}>THAT?</span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 80,
            height: 3,
            background: "#f5c518",
            borderRadius: 99,
            marginBottom: 28,
            display: "flex",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: "rgba(240,237,232,0.55)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: "Arial, sans-serif",
            display: "flex",
          }}
        >
          Daily trivia &nbsp;·&nbsp; Wager your points &nbsp;·&nbsp; Build your streak
        </div>
      </div>
    ),
    { ...size }
  );
}
