import type { ReactNode } from "react"

import { cn } from "@politocean/ui/lib/utils"

export type TimerDisplayUnit = "hours" | "minutes" | "seconds" | "milliseconds"

export type TimerDisplayProps = {
  label?: ReactNode
  elapsedMs: number
  visibleUnits?: TimerDisplayUnit[]
  className?: string
}

function pad(value: number, length = 2) {
  return value.toString().padStart(length, "0")
}

export function TimerDisplay({
  label,
  elapsedMs,
  visibleUnits = ["hours", "minutes", "seconds"],
  className,
}: TimerDisplayProps) {
  const safeElapsedMs = Math.max(0, elapsedMs)

  const hours = Math.floor(safeElapsedMs / 3_600_000)
  const minutes = Math.floor((safeElapsedMs % 3_600_000) / 60_000)
  const seconds = Math.floor((safeElapsedMs % 60_000) / 1_000)
  const milliseconds = Math.floor(safeElapsedMs % 1_000)

  const values: Record<TimerDisplayUnit, string> = {
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
    milliseconds: pad(milliseconds, 3),
  }

  const parts = visibleUnits.map((unit) => values[unit])

  const mainParts = parts.filter((_, index) => {
    const unit = visibleUnits[index]
    return unit !== "milliseconds"
  })

  const shouldShowMilliseconds = visibleUnits.includes("milliseconds")

  return (
    <div
      className={cn(
        "rounded-md border bg-muted/30 p-3 text-center",
        className
      )}
    >
      {label ? (
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      ) : null}
      <div className="font-mono text-3xl font-semibold tabular-nums">
        {mainParts.join(":")}
        {shouldShowMilliseconds && (
          <span className="text-muted-foreground">
            .{values.milliseconds}
          </span>
        )}
      </div>
    </div>
  )
}
