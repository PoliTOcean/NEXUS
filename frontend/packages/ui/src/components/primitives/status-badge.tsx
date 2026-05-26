import type { ReactNode } from "react"

import type { UiStatus } from "@politocean/ui/types"
import { Badge } from "@politocean/ui/components/badge"
import { cn } from "@politocean/ui/lib/utils"
import { StatusDot } from "@politocean/ui/components/primitives/status-dot"

export type StatusBadgeProps = {
  status?: UiStatus
  label?: ReactNode
  pulse?: boolean
  className?: string
}

const statusLabel: Record<UiStatus, string> = {
  online: "Online",
  offline: "Offline",
  loading: "Loading",
  success: "Success",
  warning: "Warning",
  error: "Error",
  unknown: "Unknown",
}

export function StatusBadge({ status = "unknown", label, pulse, className }: StatusBadgeProps) {
  const variant = status === "error" ? "destructive" : status === "online" || status === "success" ? "default" : "secondary"

  return (
    <Badge variant={variant} className={cn("gap-1.5", className)}>
      <StatusDot status={status} pulse={pulse} />
      <span>{label ?? statusLabel[status]}</span>
    </Badge>
  )
}
