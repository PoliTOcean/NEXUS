import type { ComponentPropsWithoutRef } from "react"

import type { CommandAckStatus, CommandIntent } from "@politocean/ui/types"
import { Button } from "@politocean/ui/components/button"
import { cn } from "@politocean/ui/lib/utils"
import { StatusDot } from "@politocean/ui/components/primitives/status-dot"

export type CommandButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, "children"> & {
  label: string
  description?: React.ReactNode
  intent?: CommandIntent
  busy?: boolean
  ack?: CommandAckStatus
}

const intentClassName: Record<CommandIntent, string> = {
  default: "",
  primary: "",
  neutral: "",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300",
  danger: "border-destructive/40 bg-destructive text-destructive-foreground hover:bg-destructive/90",
}

function ackToStatus(ack?: CommandAckStatus) {
  switch (ack) {
    case "pending":
      return "loading" as const
    case "success":
      return "success" as const
    case "failed":
    case "timeout":
      return "error" as const
    default:
      return undefined
  }
}

export function CommandButton({ label, description, intent = "default", busy, ack, disabled, className, ...props }: CommandButtonProps) {
  const status = ackToStatus(ack)

  return (
    <Button
      type="button"
      variant={intent === "neutral" || intent === "warning" ? "outline" : intent === "danger" ? "destructive" : "default"}
      disabled={disabled || busy}
      className={cn("h-auto min-h-10 justify-between gap-3 whitespace-normal py-2 text-left", intentClassName[intent], className)}
      {...props}
    >
      <span className="flex min-w-0 flex-col items-start">
        <span className="truncate text-sm font-medium">{busy ? `${label}...` : label}</span>
        {description ? <span className="text-xs font-normal opacity-70">{description}</span> : null}
      </span>
      {status ? <StatusDot status={status} pulse={status === "loading"} /> : null}
    </Button>
  )
}
