import type { ReactNode } from "react"

import type { StatusItem } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"
import { StatusField } from "@politocean/ui/components/primitives/status-field"

export type StatusPanelProps = {
  title?: ReactNode
  description?: ReactNode
  items: StatusItem[]
  compact?: boolean
  className?: string
}

export function StatusPanel({ title, description, items, compact, className }: StatusPanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent className={cn("grid gap-2", compact && "pt-0")}>
        {items.map((item, index) => (
          <StatusField
            key={`${String(item.label)}-${index}`}
            label={item.label}
            value={item.value ?? "N/A"}
            status={item.status}
            helperText={item.helperText}
            compact={compact}
          />
        ))}
      </PanelContent>
    </Panel>
  )
}
