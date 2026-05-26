import type { ReactNode } from "react"

import type { LogItem } from "@politocean/ui/types"
import { DataViewer } from "@politocean/ui/components/data/data-viewer"
import { LogViewer } from "@politocean/ui/components/data/log-viewer"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"

export type DebugPanelProps = {
  title?: ReactNode
  description?: ReactNode
  logs?: LogItem[]
  data?: unknown
  className?: string
}

export function DebugPanel({ title = "Debug", description, logs = [], data, className }: DebugPanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent className="grid gap-4 xl:grid-cols-2">
        <LogViewer title="Log" lines={logs} />
        <DataViewer title="Data" content={data} variant="json" />
      </PanelContent>
    </Panel>
  )
}
