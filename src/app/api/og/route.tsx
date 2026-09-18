import { ImageResponse } from "next/og";

import { OG_BACKGROUND } from "@/lib/og-background";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const subtitle = searchParams.get("subtitle");
  const cta = searchParams.get("cta");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Base OG image */}
        <img
          src={OG_BACKGROUND}
          alt={`${title ?? "Instagram Factory OS"} — Content automation for three brands`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Optional dynamic title overlay */}
        {title ? (
          <div
            style={{
              position: "absolute",
              bottom: "60px",
              left: "60px",
              right: "60px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              zIndex: 1,
            }}
          >
            {/* Semi-transparent backdrop for readability */}
            <div
              style={{
                position: "absolute",
                inset: "-24px",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
                borderRadius: "16px",
              }}
            />

            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "8px" }}>
              <h1
                style={{
                  fontSize: title.length > 40 ? "36px" : title.length > 25 ? "42px" : "48px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  textShadow: "0 2px 12px rgba(0,0,0,0.4)",
                }}
              >
                {title}
              </h1>

              {subtitle ? (
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.4,
                    margin: 0,
                    maxWidth: "600px",
                  }}
                >
                  {subtitle}
                </p>
              ) : null}

              {cta ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#22c55e",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    marginTop: "8px",
                    width: "fit-content",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#000000",
                    }}
                  >
                    {cta}
                  </span>
                  <span style={{ fontSize: "14px", color: "rgba(0,0,0,0.6)" }}>→</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
