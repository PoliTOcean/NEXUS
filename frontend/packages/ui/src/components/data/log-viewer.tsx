import { useEffect, useRef, type ReactNode } from "react"

import type { LogItem } from "@politocean/ui/types"
import { EmptyState } from "@politocean/ui/components/primitives/empty-state"
import { LogEntry } from "@politocean/ui/components/data/log-entry"
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"
import { cn } from "@politocean/ui/lib/utils"

export type LogViewerProps = {
  title?: ReactNode
  lines?: LogItem[]
  maxHeight?: number | string
  autoScroll?: boolean
  className?: string
}

export function LogViewer({
  title,
  lines = [],
  maxHeight = 260,
  autoScroll = true,
  className,
}: LogViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoScroll) return

    const viewport = viewportRef.current
    if (!viewport) return

    viewport.scrollTop = viewport.scrollHeight
  }, [autoScroll, lines])

  return (
    <Panel className={cn("flex min-h-0 flex-col", className)}>
      {title ? (
        <PanelHeader>
          <PanelTitle>{title}</PanelTitle>
        </PanelHeader>
      ) : null}
      <PanelContent className="min-h-0 flex-1">
        {lines.length > 0 ? (
          <div
            ref={viewportRef}
            className="h-full min-h-0 space-y-1 overflow-y-auto overscroll-contain rounded-md border bg-muted/30 p-3"
            style={{ maxHeight }}
          >
            {lines.map((line, index) => (
              <LogEntry key={line.id ?? index} timestamp={line.timestamp} level={line.level}>
                {line.message}
              </LogEntry>
            ))}
          </div>
        ) : (
          <EmptyState title="No log entries" />
        )}
      </PanelContent>
    </Panel>
  )
}
