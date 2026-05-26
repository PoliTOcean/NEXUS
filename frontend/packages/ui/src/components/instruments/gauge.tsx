import type { ReactNode } from "react"

import { cn } from "@politocean/ui/lib/utils"

export type GaugeProps = {
  label?: ReactNode
  value: number
  min?: number
  max?: number
  unit?: ReactNode
  className?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function Gauge({ label, value, min = 0, max = 100, unit, className }: GaugeProps) {
  const normalized = ((clamp(value, min, max) - min) / (max - min)) * 100

  return (
    <div className={cn("w-full max-w-48 space-y-3", className)}>
      <div className="relative aspect-square rounded-full border bg-muted/30 p-4">
        <div
          className="absolute inset-4 rounded-full border-8 border-muted"
          style={{
            background: `conic-gradient(var(--primary) ${normalized}%, transparent 0)`,
          }}
        />
        <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-background text-center">
          <div className="text-3xl font-semibold tabular-nums">{Math.round(value)}</div>
          {unit ? <div className="text-xs text-muted-foreground">{unit}</div> : null}
        </div>
      </div>
      {label ? <div className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div> : null}
    </div>
  )
}
