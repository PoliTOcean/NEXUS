import { TelemetryPanel } from "@politocean/ui"

import type { EvaTelemetry } from "@/types/eva"

type EvaTelemetryPanelProps = {
  telemetry: EvaTelemetry
}

export function EvaTelemetryPanel({ telemetry }: EvaTelemetryPanelProps) {
  return (
    <TelemetryPanel
      metrics={[
        {
          label: "Height reference",
          value: telemetry.relativeAltitude,
          unit: "m",
          precision: 2,
          status: "online",
        },
        {
          label: "Absolute height",
          value: telemetry.absoluteAltitude,
          unit: "m",
          precision: 2,
          status: "online",
        },
        {
          label: "Pitch",
          value: telemetry.pitch,
          unit: "deg",
          precision: 1,
          status: "online",
        },
        {
          label: "Pitch reference",
          value: telemetry.pitchReference,
          unit: "deg",
          precision: 1,
          status: "online",
        },
      ]}
      columns={1}
      className="min-h-0 flex-1 bg-card/70"
      headerClassName="p-3"
      contentClassName="min-h-0 overflow-y-auto p-3 pt-0"
      gridClassName="grid-cols-1 gap-3"
    />
  )
}
