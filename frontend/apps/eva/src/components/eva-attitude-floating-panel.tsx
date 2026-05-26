import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@politocean/ui"

import pitchIcon from "@/assets/attitude/pitch_icon.svg"
import rollIcon from "@/assets/attitude/roll_icon.svg"
import yawIcon from "@/assets/attitude/yaw_icon.svg"
import type { EvaTelemetry } from "@/types/eva"

type EvaAttitudeFloatingPanelProps = {
  telemetry: EvaTelemetry
}

function formatDegrees(value: number | null) {
  return value === null ? "--.-" : value.toFixed(1)
}

export function EvaAttitudeFloatingPanel({
  telemetry,
}: EvaAttitudeFloatingPanelProps) {
  const metrics = [
    {
      id: "roll",
      label: "Roll",
      value: telemetry.roll,
      icon: rollIcon,
    },
    {
      id: "pitch",
      label: "Pitch",
      value: telemetry.pitch,
      icon: pitchIcon,
    },
    {
      id: "yaw",
      label: "Yaw",
      value: telemetry.heading,
      icon: yawIcon,
    },
  ]

  const getRotationStyle = (id: string, value: number | null) => {
    if (value === null) return {}
    
    switch (id) {
      case "roll":
        return {
          transform: `rotateZ(${value}deg)`,
        }
      case "pitch":
        return {
          transform: `rotateZ(${-value}deg)`,
        }
      case "yaw":
        return {
          transform: `rotateZ(${value}deg)`,
        }
      default:
        return {}
    }
  }

  return (
    <Panel className="max-h-full overflow-hidden border-border/70 bg-card/70 text-card-foreground shadow-lg backdrop-blur-md">
      <PanelHeader className="p-3">
        <PanelTitle className="text-sm">Attitude</PanelTitle>
      </PanelHeader>
      <PanelContent className="grid max-h-[calc(100%-2.75rem)] grid-cols-1 gap-2 overflow-y-auto p-3 pt-0">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="flex flex-col items-center justify-between rounded-md border bg-background/45 p-3"
          >
            <div
              style={{
                perspective: "600px",
                perspectiveOrigin: "center center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "min(6rem, 18vh)",
                height: "min(6rem, 18vh)",
              } as React.CSSProperties & { perspective: string; perspectiveOrigin: string }}
            >
              <img
                src={metric.icon}
                alt=""
                aria-hidden="true"
                className="h-auto w-full object-contain"
                style={{
                  ...getRotationStyle(metric.id, metric.value),
                  transformOrigin: "center center",
                  transition: "transform 0.1s ease-out",
                }}
              />
            </div>
            <div className="min-w-0 text-center">
              <div className="text-xs font-medium uppercase text-muted-foreground">
                {metric.label}
              </div>
              <div className="font-mono text-sm font-semibold tabular-nums">
                {formatDegrees(metric.value)} deg
              </div>
            </div>
          </div>
        ))}
      </PanelContent>
    </Panel>
  )
}
