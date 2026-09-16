import type { AssetLibrary } from "@/design/types";

/**
 * The local asset library.
 *
 * Everything is an inline vector path — no external requests at render time,
 * nothing to download, everything themeable through `currentColor`. The library
 * is deliberately small and editorial: assets are ingredients for a template,
 * not clip art.
 *
 * Flags are simple geometric abstractions drawn from the official colours, not
 * vexillologically exact renditions — at carousel size the abstraction reads
 * better and stays on-system.
 */

export const assetLibrary: AssetLibrary = {
  icons: [
    {
      id: "route",
      label: "Shipping route",
      tags: ["geo", "trade", "map"],
      viewBox: "0 0 48 48",
      paths: [
        "M6 36 C14 36 16 24 24 24 S34 12 42 12",
        "M36 8 L42 12 L36 16",
      ],
    },
    {
      id: "wave",
      label: "Waves",
      tags: ["ocean", "water"],
      viewBox: "0 0 48 48",
      paths: [
        "M4 16 C10 10 14 22 24 16 S38 10 44 16",
        "M4 28 C10 22 14 34 24 28 S38 22 44 28",
        "M4 40 C10 34 14 46 24 40 S38 34 44 40",
      ],
    },
    {
      id: "alert",
      label: "Warning",
      tags: ["risk", "status"],
      viewBox: "0 0 48 48",
      paths: [
        "M24 6 L44 40 L4 40 Z",
        "M24 18 L24 28",
        "M24 34 L24 34.01",
      ],
    },
    {
      id: "eye",
      label: "Eye",
      tags: ["attention", "psych"],
      viewBox: "0 0 48 48",
      paths: [
        "M4 24 C12 12 36 12 44 24 C36 36 12 36 4 24 Z",
        "M24 24 M18 24 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0",
      ],
    },
    {
      id: "target",
      label: "Target",
      tags: ["focus", "brand"],
      viewBox: "0 0 48 48",
      paths: [
        "M24 4 a20 20 0 1 0 0.01 0",
        "M24 14 a10 10 0 1 0 0.01 0",
        "M24 24 M22 24 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0",
      ],
    },
    {
      id: "crown",
      label: "Crown",
      tags: ["leader", "brand"],
      viewBox: "0 0 48 48",
      paths: ["M6 34 L6 16 L16 24 L24 10 L32 24 L42 16 L42 34 Z", "M6 40 L42 40"],
    },
    {
      id: "compass",
      label: "Compass",
      tags: ["geo", "direction"],
      viewBox: "0 0 48 48",
      paths: [
        "M24 4 a20 20 0 1 0 0.01 0",
        "M31 17 L27 27 L17 31 L21 21 Z",
      ],
    },
    {
      id: "brain",
      label: "Brain",
      tags: ["psych", "mind"],
      viewBox: "0 0 48 48",
      paths: [
        "M24 8 a10 10 0 0 0 -10 10 c-4 2 -6 6 -4 10 s6 6 8 6 l0 6 a4 4 0 0 0 4 4 l4 0 a4 4 0 0 0 4 -4 l0 -6 c2 0 6 -2 8 -6 s0 -8 -4 -10 a10 10 0 0 0 -10 -10 Z",
        "M24 8 L24 44",
      ],
    },
    {
      id: "layers",
      label: "Layers",
      tags: ["brand", "system"],
      viewBox: "0 0 48 48",
      paths: ["M24 6 L44 16 L24 26 L4 16 Z", "M4 26 L24 36 L44 26", "M4 34 L24 44 L44 34"],
    },
    {
      id: "clock",
      label: "Clock",
      tags: ["time", "ritual"],
      viewBox: "0 0 48 48",
      paths: ["M24 6 a18 18 0 1 0 0.01 0", "M24 14 L24 24 L32 28"],
    },
  ],
  illustrations: [
    {
      id: "memory",
      label: "Overlapping memories",
      tags: ["psych", "abstract"],
      viewBox: "0 0 240 240",
      paths: [
        "M60 90 a48 48 0 1 0 0.1 0",
        "M110 120 a48 48 0 1 0 0.1 0",
        "M70 150 a40 40 0 1 0 0.1 0",
      ],
    },
    {
      id: "growth",
      label: "Growth curve",
      tags: ["psych", "learning"],
      viewBox: "0 0 240 240",
      paths: ["M20 200 C80 200 60 60 120 80 S200 40 220 24", "M20 200 L220 200"],
    },
    {
      id: "arch",
      label: "Arch structure",
      tags: ["geo", "structure"],
      viewBox: "0 0 240 240",
      paths: [
        "M40 200 L40 120 a80 80 0 0 1 160 0 L200 200",
        "M80 200 L80 130 a40 40 0 0 1 80 0 L160 200",
        "M24 200 L216 200",
      ],
    },
  ],
  patterns: [
    {
      id: "contour",
      label: "Contour lines",
      tags: ["geo", "topo"],
      viewBox: "0 0 240 240",
      paths: [
        "M0 60 C60 30 180 90 240 60",
        "M0 100 C60 70 180 130 240 100",
        "M0 140 C60 110 180 170 240 140",
        "M0 180 C60 150 180 210 240 180",
      ],
    },
    {
      id: "dots",
      label: "Dot grid",
      tags: ["psych", "calm"],
      viewBox: "0 0 240 240",
      paths: [
        "M30 30 h0.01 M90 30 h0.01 M150 30 h0.01 M210 30 h0.01",
        "M30 90 h0.01 M90 90 h0.01 M150 90 h0.01 M210 90 h0.01",
        "M30 150 h0.01 M90 150 h0.01 M150 150 h0.01 M210 150 h0.01",
        "M30 210 h0.01 M90 210 h0.01 M150 210 h0.01 M210 210 h0.01",
      ],
    },
    {
      id: "grid",
      label: "Hard grid",
      tags: ["brand", "system"],
      viewBox: "0 0 240 240",
      paths: ["M80 0 L80 240", "M160 0 L160 240", "M0 80 L240 80", "M0 160 L240 160"],
    },
    {
      id: "lines",
      label: "Rule lines",
      tags: ["brand", "editorial"],
      viewBox: "0 0 240 240",
      paths: ["M0 48 L240 48", "M0 96 L240 96", "M0 144 L240 144", "M0 192 L240 192"],
    },
  ],
  flags: [
    {
      id: "jp",
      label: "Japan",
      tags: ["geo"],
      viewBox: "0 0 60 40",
      paths: ["M30 20 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0"],
      fills: ["#BC002D"],
    },
    {
      id: "sg",
      label: "Singapore",
      tags: ["geo", "strait"],
      viewBox: "0 0 60 40",
      paths: ["M30 12 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0"],
      fills: ["#ED2939"],
    },
    {
      id: "cn",
      label: "China",
      tags: ["geo", "trade"],
      viewBox: "0 0 60 40",
      paths: ["M14 12 L17.2 21.4 L8.8 15.6 L19.2 15.6 L10.8 21.4 Z"],
      fills: ["#FFDE00"],
    },
    {
      id: "us",
      label: "United States",
      tags: ["geo"],
      viewBox: "0 0 60 40",
      paths: [
        "M0 0 L60 0 L60 40 L0 40 Z",
        "M0 0 L28 0 L28 21 L0 21 Z",
      ],
      fills: ["#B22234", "#3C3B6E"],
    },
  ],
};
