import type { ReactNode } from "react"

import type { StatusItem } from "@politocean/ui/types"
import { StatusPanel } from "@politocean/ui/components/primitives/status-panel"

export type StatusOverviewPanelProps = {
  title?: ReactNode
  description?: ReactNode
  items: StatusItem[]
  compact?: boolean
  className?: string
}

export function StatusOverviewPanel({ title = "System Status", description, items, compact, className }: StatusOverviewPanelProps) {
  return <StatusPanel title={title} description={description} items={items} compact={compact} className={className} />
}
