import { ImageResponse } from "next/og";

export const runtime = "edge";

const BACKGROUND_IMAGE =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK61v6y95wvCP90SQdZ49wKtKWfN2oyh-gE4oaY25Cr9-0EGRUyjv9RVAM&s=10";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Instagram Factory OS";
  const subtitle = searchParams.get("subtitle") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Background image */}
        <img
          src={BACKGROUND_IMAGE}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Dark gradient overlay for text readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)",
          }}
        />

        {/* Subtle grain texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.03,
            background:
              "repeating-conic-gradient(rgba(255,255,255,0.1) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px",
          }}
        />

        {/* Content container */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            padding: "60px",
            zIndex: 1,
          }}
        >
          {/* Brand badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.7)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Instagram Factory OS
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: title.length > 40 ? "40px" : title.length > 25 ? "48px" : "56px",
              fontWeight: 600,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: 0,
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
              maxWidth: "900px",
            }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle ? (
            <p
              style={{
                fontSize: "18px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.4,
                margin: 0,
                maxWidth: "700px",
              }}
            >
              {subtitle}
            </p>
          ) : null}

          {/* Bottom bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                height: "1px",
                width: "40px",
                background: "rgba(255,255,255,0.3)",
              }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.03em",
              }}
            >
              Content automation for three brands
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
