import type { ReactNode } from "react"

import type { CommandAckStatus } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { StatusDot } from "@politocean/ui/components/primitives/status-dot"

export type AckStatusProps = {
  status?: CommandAckStatus
  command?: ReactNode
  className?: string
}

const statusText: Record<CommandAckStatus, string> = {
  none: "N/A",
  pending: "Pending",
  success: "Success",
  failed: "Failed",
  timeout: "Timeout",
}

const dotStatus = {
  none: "unknown",
  pending: "loading",
  success: "success",
  failed: "error",
  timeout: "warning",
} as const

export function AckStatus({ status = "none", command, className }: AckStatusProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm", className)}>
      <span className="text-muted-foreground">Last Command ACK</span>
      <span className="flex items-center gap-2 font-medium">
        <StatusDot status={dotStatus[status]} pulse={status === "pending"} />
        {command ? <span>{command}: </span> : null}
        <span>{statusText[status]}</span>
      </span>
    </div>
  )
}
