import type { ReactNode } from "react"

import { cn } from "@politocean/ui/lib/utils"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"

export type ScrollablePanelProps = {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  maxHeight?: number | string
  className?: string
  contentClassName?: string
}

export function ScrollablePanel({
  title,
  description,
  children,
  maxHeight = 280,
  className,
  contentClassName,
}: ScrollablePanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent>
        <div className={cn("overflow-auto pr-2", contentClassName)} style={{ maxHeight }}>
          {children}
        </div>
      </PanelContent>
    </Panel>
  )
}
