import type { ReactNode } from "react"

import { cn } from "@politocean/ui/lib/utils"

export type ValueDisplaySize = "sm" | "md" | "lg"

export type ValueDisplayProps = {
  label?: ReactNode
  value: string | number | null | undefined
  unit?: ReactNode
  precision?: number
  size?: ValueDisplaySize
  helperText?: ReactNode
  className?: string
}

const sizeClassName: Record<ValueDisplaySize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
}

function formatValue(value: ValueDisplayProps["value"], precision?: number) {
  if (value === null || value === undefined || value === "") return "N/A"
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(precision ?? 2) : "N/A"
  return value
}

export function ValueDisplay({ label, value, unit, precision, size = "md", helperText, className }: ValueDisplayProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label ? <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div> : null}
      <div className="flex items-baseline gap-1">
        <span className={cn("font-semibold tabular-nums", sizeClassName[size])}>{formatValue(value, precision)}</span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {helperText ? <div className="text-xs text-muted-foreground">{helperText}</div> : null}
    </div>
  )
}
