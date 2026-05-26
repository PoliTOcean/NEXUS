import type { UiStatus } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"

export type StatusDotProps = {
  status?: UiStatus
  pulse?: boolean
  className?: string
}

const statusClassName: Record<UiStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-muted-foreground",
  loading: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
  unknown: "bg-muted-foreground",
}

export function StatusDot({ status = "unknown", pulse, className }: StatusDotProps) {
  return (
    <span className="relative inline-flex size-2.5 items-center justify-center" aria-hidden="true">
      {pulse && status !== "offline" && status !== "unknown" ? (
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-50", statusClassName[status])} />
      ) : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", statusClassName[status], className)} />
    </span>
  )
}
