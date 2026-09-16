import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  className?: string;
  width?: number;
  height?: number;
  /** Screen-reader summary, e.g. "Reach trend, 7 points". */
  label: string;
}

/**
 * Monochrome trend line: stroke only, no fills or gradients, so it reads as
 * data rather than decoration.
 */
export function Sparkline({
  data,
  className,
  width = 120,
  height = 32,
  label,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={cn("overflow-visible text-ink", className)}
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) * stepX}
        cy={
          height -
          ((data[data.length - 1] - min) / span) * (height - 4) -
          2
        }
        r={2.25}
        fill="currentColor"
      />
    </svg>
  );
}
