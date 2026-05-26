import { useEffect, useRef, useState } from "react"

import { Button } from "@politocean/ui/components/button"
import {
  TimerDisplay,
  type TimerDisplayUnit,
} from "@politocean/ui/components/data/timer-display"
import { cn } from "@politocean/ui/lib/utils"

export type StopwatchProps = {
  title?: string
  running?: boolean
  defaultElapsedMs?: number
  compact?: boolean
  visibleUnits?: TimerDisplayUnit[]
  className?: string
}

export function Stopwatch({
  title = "Stopwatch",
  running: controlledRunning,
  defaultElapsedMs = 0,
  compact,
  visibleUnits = ["hours", "minutes", "seconds"],
  className,
}: StopwatchProps) {
  const [internalRunning, setInternalRunning] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(defaultElapsedMs)

  const running = controlledRunning ?? internalRunning
  const startedAtRef = useRef<number | null>(null)
  const baseElapsedMsRef = useRef(defaultElapsedMs)
  const elapsedMsRef = useRef(defaultElapsedMs)

  useEffect(() => {
    elapsedMsRef.current = elapsedMs
  }, [elapsedMs])

  useEffect(() => {
    if (running) {
      baseElapsedMsRef.current = elapsedMsRef.current
      startedAtRef.current = performance.now()
    } else {
      startedAtRef.current = null
    }
  }, [running])

  useEffect(() => {
    if (!running) return

    const shouldShowMilliseconds = visibleUnits.includes("milliseconds")
    const intervalMs = shouldShowMilliseconds ? 10 : 100

    const interval = window.setInterval(() => {
      if (startedAtRef.current === null) return
      const nextElapsedMs =
        baseElapsedMsRef.current + performance.now() - startedAtRef.current

      elapsedMsRef.current = nextElapsedMs
      setElapsedMs(nextElapsedMs)
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [running, visibleUnits])

  function toggle() {
    setInternalRunning((value) => !value)
  }

  function reset() {
    baseElapsedMsRef.current = 0
    elapsedMsRef.current = 0
    setElapsedMs(0)

    if (running) {
      setInternalRunning(false)
      startedAtRef.current = null
    }
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-card text-card-foreground",
        compact ? "space-y-2 p-3" : "space-y-3 p-4",
        className
      )}
    >
      <div>
        <p className="text-sm font-medium">{title}</p>
      </div>

      <TimerDisplay
        elapsedMs={elapsedMs}
        visibleUnits={visibleUnits}
        className={cn(compact && "p-2 [&>div]:text-2xl")}
      />

      {controlledRunning === undefined && (
        <div className="flex gap-2">
          <Button size={compact ? "xs" : "sm"} variant={running ? "default" : "default"} onClick={toggle}>
            {running ? "Pause" : "Start"}
          </Button>

          <Button size={compact ? "xs" : "sm"} variant="destructive" onClick={reset}>
            Reset
          </Button>
        </div>
      )}
    </div>
  )
}
