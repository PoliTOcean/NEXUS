import type { ReactNode } from "react"

import type { LogLevel } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"

export type LogEntryProps = {
  timestamp?: string
  level?: LogLevel
  children: ReactNode
  className?: string
}

const levelClassName: Record<LogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
}

export function LogEntry({ timestamp, level = "info", children, className }: LogEntryProps) {
  return (
    <div className={cn("grid grid-cols-[auto_auto_1fr] gap-2 font-mono text-xs", levelClassName[level], className)}>
      <span className="text-muted-foreground">{timestamp ?? "--:--:--"}</span>
      <span className="uppercase opacity-80">{level}</span>
      <span className="break-words">{children}</span>
    </div>
  )
}
