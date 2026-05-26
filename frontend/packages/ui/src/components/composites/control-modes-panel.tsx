import type { ReactNode } from "react"

import type { ControlModeItem } from "@politocean/ui/types"
import { ControlToggle } from "@politocean/ui/components/controls/control-toggle"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"

export type ControlModesPanelProps = {
  title?: ReactNode
  description?: ReactNode
  modes: ControlModeItem[]
  className?: string
}

export function ControlModesPanel({ title = "Control Modes", description, modes, className }: ControlModesPanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent className="grid gap-2 sm:grid-cols-2">
        {modes.map((mode, index) => (
          <ControlToggle
            key={mode.id ?? `${mode.label}-${index}`}
            label={mode.label}
            description={mode.description}
            active={mode.active}
            status={mode.status}
            disabled={mode.disabled}
            onChange={mode.onChange}
          />
        ))}
      </PanelContent>
    </Panel>
  )
}
