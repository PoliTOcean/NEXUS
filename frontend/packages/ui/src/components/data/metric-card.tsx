import type { ReactNode } from "react"

import type { UiStatus } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { StatusDot } from "@politocean/ui/components/primitives/status-dot"
import { ValueDisplay, type ValueDisplaySize } from "@politocean/ui/components/data/value-display"

export type MetricCardProps = {
  label: ReactNode
  value: string | number | null | undefined
  unit?: ReactNode
  precision?: number
  status?: UiStatus
  helperText?: ReactNode
  icon?: ReactNode
  compact?: boolean
  valueSize?: ValueDisplaySize
  className?: string
}

export function MetricCard({
  label,
  value,
  unit,
  precision,
  status,
  helperText,
  icon,
  compact,
  valueSize,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card text-card-foreground shadow-sm",
        compact ? "p-2.5" : "p-4",
        className
      )}
    >
      <div className={cn("flex items-center justify-between gap-3", compact ? "mb-1.5" : "mb-3")}>
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
          <div
            className={cn(
              "truncate font-medium uppercase tracking-wide text-muted-foreground",
              compact ? "text-[10px]" : "text-xs"
            )}
          >
            {label}
          </div>
        </div>
        {status ? <StatusDot status={status} pulse={status === "online" || status === "loading"} /> : null}
      </div>
      <ValueDisplay
        value={value}
        unit={unit}
        precision={precision}
        helperText={helperText}
        size={valueSize ?? (compact ? "sm" : "md")}
        className={cn(compact && "space-y-0")}
      />
    </div>
  )
}
