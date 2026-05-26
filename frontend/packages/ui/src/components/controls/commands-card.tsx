import type { ReactNode } from "react"

import { cn } from "@politocean/ui/lib/utils"
import type { UiStatus } from "@politocean/ui/types"

export type CommandsCardProps = {
  label: ReactNode
  status?: UiStatus
  compact?: boolean
  className?: string
}

const statusClassName: Record<UiStatus, string> = {
  online:
    "border-emerald-800/80 bg-emerald-800/60 text-white shadow-emerald-700/20 dark:border-emerald-400/90 dark:bg-emerald-500/20 dark:text-emerald-50 dark:shadow-emerald-500/20",
  success:
    "border-emerald-800/80 bg-emerald-800/60 text-white shadow-emerald-700/20 dark:border-emerald-400/90 dark:bg-emerald-500/20 dark:text-emerald-50 dark:shadow-emerald-500/20",
  loading:
    "border-red-800/80 bg-red-800/60 text-white shadow-red-700/20 dark:border-red-400/90 dark:bg-red-500/20 dark:text-red-50 dark:shadow-red-500/20",
  warning:
    "border-red-800/80 bg-red-800/60 text-white shadow-red-700/20 dark:border-red-400/90 dark:bg-red-500/20 dark:text-red-50 dark:shadow-red-500/20",
  error:
    "border-red-800/80 bg-red-800/60 text-white shadow-red-700/20 dark:border-red-400/90 dark:bg-red-500/20 dark:text-red-50 dark:shadow-red-500/20",
  offline: "border-border bg-card text-card-foreground",
  unknown: "border-border bg-card text-card-foreground",
}

export function CommandsCard({
  label,
  status = "unknown",
  compact,
  className,
}: CommandsCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border text-center shadow-sm transition-colors",
        compact ? "min-h-10 px-2 py-2" : "min-h-14 px-3 py-3",
        statusClassName[status],
        className
      )}
    >
      <div
        className={cn(
          "min-w-0 truncate font-semibold uppercase tracking-wide",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {label}
      </div>
    </div>
  )
}
