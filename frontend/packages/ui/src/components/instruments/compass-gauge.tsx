import { cn } from "@politocean/ui/lib/utils"

export type CompassGaugeProps = {
  heading: number
  className?: string
}

const TICK_ANGLES = Array.from({ length: 36 }, (_, index) => index * 10)
const CARDINAL_DIRECTIONS = [
  { label: "N", angle: 0 },
  { label: "E", angle: 90 },
  { label: "S", angle: 180 },
  { label: "W", angle: 270 },
]

function normalizeHeading(heading: number) {
  return ((heading % 360) + 360) % 360
}

function pointOnCircle(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180

  return {
    x: 100 + radius * Math.cos(radians),
    y: 100 + radius * Math.sin(radians),
  }
}

export function CompassGauge({ heading, className }: CompassGaugeProps) {
  const normalized = normalizeHeading(heading)

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <svg
        aria-label={`Heading ${normalized.toFixed(0)} degrees`}
        className="size-40"
        role="img"
        viewBox="0 0 200 200"
      >
        <circle
          className="fill-transparent stroke-border"
          cx="100"
          cy="100"
          r="92"
          strokeWidth="2"
        />

        {TICK_ANGLES.map((angle) => {
          const major = angle % 30 === 0

          return (
            <line
              key={angle}
              className={major ? "stroke-foreground" : "stroke-muted-foreground"}
              strokeLinecap="round"
              strokeWidth={major ? 1.5 : 1}
              opacity={major ? 0.75 : 0.35}
              transform={`rotate(${angle} 100 100)`}
              x1="100"
              x2="100"
              y1="10"
              y2={major ? 20 : 16}
            />
          )
        })}

        {CARDINAL_DIRECTIONS.map((direction) => {
          const point = pointOnCircle(direction.angle, 58)

          return (
            <text
              key={direction.label}
              className="fill-muted-foreground text-xs font-medium"
              dominantBaseline="middle"
              textAnchor="middle"
              x={point.x}
              y={point.y}
            >
              {direction.label}
            </text>
          )
        })}

        <g transform={`rotate(${normalized} 100 100)`}>
          <line
            className="stroke-primary"
            strokeLinecap="round"
            strokeWidth="4"
            x1="100"
            x2="100"
            y1="100"
            y2="30"
          />
          <path className="fill-primary" d="M100 14 L91 35 L109 35 Z" />
        </g>
        <circle className="fill-primary" cx="100" cy="100" r="5" />
        <circle
          className="fill-background"
          cx="100"
          cy="100"
          r="2"
        />
      </svg>
      <div className="font-mono text-xl font-semibold tabular-nums">{normalized.toFixed(0)}°</div>
    </div>
  )
}
