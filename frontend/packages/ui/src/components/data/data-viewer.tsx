import type { ReactNode } from "react"

import { cn } from "@politocean/ui/lib/utils"
import { EmptyState } from "@politocean/ui/components/primitives/empty-state"
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"
import type { DataViewerVariant } from "@politocean/ui/types"

export type DataViewerProps = {
  title?: ReactNode
  content?: unknown
  emptyMessage?: ReactNode
  variant?: DataViewerVariant
  maxHeight?: number | string
  className?: string
}

function stringifyContent(content: unknown, variant: DataViewerVariant) {
  if (content === null || content === undefined || content === "") return ""
  if (variant === "json") return JSON.stringify(content, null, 2)
  if (typeof content === "string") return content
  return String(content)
}

export function DataViewer({ title, content, emptyMessage = "No data available", variant = "plain", maxHeight = 260, className }: DataViewerProps) {
  const text = stringifyContent(content, variant)

  return (
    <Panel className={className}>
      {title ? (
        <PanelHeader>
          <PanelTitle>{title}</PanelTitle>
        </PanelHeader>
      ) : null}
      <PanelContent>
        {text ? (
          <pre
            className={cn(
              "overflow-auto rounded-md border bg-muted/40 p-3 text-xs",
              variant !== "plain" && "font-mono",
            )}
            style={{ maxHeight }}
          >
            {text}
          </pre>
        ) : (
          <EmptyState title={emptyMessage} />
        )}
      </PanelContent>
    </Panel>
  )
}
