import type { ReactNode } from "react"

import type { UiStatus } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { StatusDot } from "@politocean/ui/components/primitives/status-dot"

export type AlertSeverity = Extract<UiStatus, "success" | "warning" | "error"> | "info"

export type AlertBannerProps = {
  severity?: AlertSeverity
  title?: ReactNode
  children?: ReactNode
  className?: string
}

const severityToStatus: Record<AlertSeverity, UiStatus> = {
  info: "loading",
  success: "success",
  warning: "warning",
  error: "error",
}

const severityClassName: Record<AlertSeverity, string> = {
  info: "border-sky-500/30 bg-sky-500/10",
  success: "border-emerald-500/30 bg-emerald-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
  error: "border-destructive/30 bg-destructive/10",
}

export function AlertBanner({ severity = "info", title, children, className }: AlertBannerProps) {
  return (
    <div className={cn("flex gap-3 rounded-md border p-3 text-sm", severityClassName[severity], className)}>
      <StatusDot status={severityToStatus[severity]} className="mt-1" />
      <div className="space-y-1">
        {title ? <div className="font-medium">{title}</div> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  )
}
