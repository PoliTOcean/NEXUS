import type { ReactNode } from "react"

import { Stopwatch } from "@politocean/ui/components/controls/stopwatch"
import { TimerDisplay } from "@politocean/ui/components/data/timer-display"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"

export type TimingPanelProps = {
  title?: ReactNode
  description?: ReactNode
  missionElapsedMs?: number
  stopwatchElapsedMs?: number
  className?: string
}

export function TimingPanel({ title = "Timing", description, missionElapsedMs = 0, stopwatchElapsedMs = 0, className }: TimingPanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent className="grid gap-4 md:grid-cols-2">
        <TimerDisplay label="Mission Time" elapsedMs={missionElapsedMs} />
        <Stopwatch title="Stopwatch" defaultElapsedMs={stopwatchElapsedMs} />
      </PanelContent>
    </Panel>
  )
}
