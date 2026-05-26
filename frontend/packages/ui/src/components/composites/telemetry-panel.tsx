import type { ReactNode } from "react"

import type { MetricItem } from "@politocean/ui/types"
import { MetricCard } from "@politocean/ui/components/data/metric-card"
import { MetricGrid } from "@politocean/ui/components/data/metric-grid"
import { cn } from "@politocean/ui/lib/utils"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"

export type TelemetryPanelProps = {
  title?: ReactNode
  description?: ReactNode
  metrics: MetricItem[]
  columns?: 1 | 2 | 3 | 4
  compactMetrics?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  gridClassName?: string
}

export function TelemetryPanel({
  title = "Telemetry",
  description,
  metrics,
  columns = 4,
  compactMetrics,
  className,
  headerClassName,
  contentClassName,
  gridClassName,
}: TelemetryPanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader className={headerClassName}>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent className={contentClassName}>
        <MetricGrid columns={columns} className={cn(gridClassName)}>
          {metrics.map((metric, index) => (
            <MetricCard
              key={`${String(metric.label)}-${index}`}
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              precision={metric.precision}
              status={metric.status}
              helperText={metric.helperText}
              icon={metric.icon}
              compact={compactMetrics}
            />
          ))}
        </MetricGrid>
      </PanelContent>
    </Panel>
  )
}
