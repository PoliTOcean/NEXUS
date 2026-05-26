import type { ReactNode } from "react"

import type { UiStatus } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { StatusDot } from "@politocean/ui/components/primitives/status-dot"

export type StatusFieldProps = {
  label: ReactNode
  value: ReactNode
  status?: UiStatus
  helperText?: ReactNode
  compact?: boolean
  className?: string
}

export function StatusField({ label, value, status = "unknown", helperText, compact, className }: StatusFieldProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-md border bg-card", compact ? "px-3 py-2" : "p-3", className)}>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {helperText ? <div className="mt-0.5 text-xs text-muted-foreground">{helperText}</div> : null}
      </div>
      <div className="flex items-center gap-2 text-right text-sm font-medium">
        <StatusDot status={status} pulse={status === "loading" || status === "online"} />
        <span>{value}</span>
      </div>
    </div>
  )
}
