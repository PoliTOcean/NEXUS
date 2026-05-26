import type { ReactNode } from "react"

import { AttitudeIndicator } from "@politocean/ui/components/instruments/attitude-indicator"
import { CompassGauge } from "@politocean/ui/components/instruments/compass-gauge"
import { Gauge } from "@politocean/ui/components/instruments/gauge"
import { cn } from "@politocean/ui/lib/utils"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"

export type InstrumentPanelProps = {
  title?: ReactNode
  description?: ReactNode
  heading?: number
  roll?: number
  pitch?: number
  battery?: number
  compact?: boolean
  showBattery?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function InstrumentPanel({
  title = "Instruments",
  description,
  heading = 0,
  roll = 0,
  pitch = 0,
  battery = 0,
  compact,
  showBattery = true,
  className,
  headerClassName,
  contentClassName,
}: InstrumentPanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader className={cn(compact && "p-2", headerClassName)}>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent
        className={cn(
          showBattery ? "grid gap-6 md:grid-cols-3" : "flex items-center justify-start gap-3",
          compact && "p-2 pt-0",
          contentClassName
        )}
      >
        <div className="flex justify-center">
          <CompassGauge
            heading={heading}
            className={
              compact
                ? "gap-1.5 [&>svg]:size-28 [&>div]:text-base"
                : undefined
            }
          />
        </div>
        <div className="flex justify-center">
          <AttitudeIndicator
            roll={roll}
            pitch={pitch}
            className={
              compact
                ? "gap-1.5 [&>div:first-child]:size-28 [&>div:last-child]:gap-2 [&>div:last-child]:text-xs"
                : undefined
            }
          />
        </div>
        {showBattery ? (
          <div className="flex justify-center">
            <Gauge label="Battery" value={battery} unit="%" />
          </div>
        ) : null}
      </PanelContent>
    </Panel>
  )
}
