import { useState } from "react"
import { StatusBadge, Stopwatch } from "@politocean/ui"

import { EvaCameraDeck } from "@/components/eva-camera-deck"
import { EvaControllerMapDialog } from "@/components/eva-controller-map-dialog"
import { EvaJoystickStatusPanel } from "@/components/eva-joystick-status-panel"
import { EvaTelemetryPanel } from "@/components/eva-telemetry-rail"
import { useEvaMissionState } from "@/hooks/use-eva-mission-state"

export function EvaMissionControl() {
  const { state, selectCamera, setCameraEnabled } = useEvaMissionState()
  const [controllerMapOpen, setControllerMapOpen] = useState(false)

  return (
    <main className="h-svh bg-background text-foreground">
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border bg-card/70 px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Eva Mission Control
            </h1>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              ROV / Live Backend
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state.connections.map((connection) => (
              <StatusBadge
                key={connection.id}
                status={connection.status}
                label={`${connection.label}: ${connection.detail}`}
                pulse={
                  connection.status === "success" ||
                  connection.status === "loading"
                }
              />
            ))}
            <StatusBadge status="success" label="UI ready" pulse />
          </div>
        </header>

        <EvaControllerMapDialog
          open={controllerMapOpen}
          onOpenChange={setControllerMapOpen}
        />

        <section className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-3 overflow-hidden 2xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <Stopwatch
                title="Stopwatch"

                visibleUnits={["minutes", "seconds", "milliseconds"]}
                className="shrink-0 bg-card/70"
              />

              <EvaJoystickStatusPanel
                statuses={state.joystickCommandStatuses}
                onOpenControllerMap={() => setControllerMapOpen(true)}
              />

              <EvaTelemetryPanel telemetry={state.telemetry} />
            </aside>

            <EvaCameraDeck
              cameras={state.cameras}
              primaryCameraId={state.primaryCameraId}
              telemetry={state.telemetry}
              onSelectCamera={selectCamera}
              onCameraEnabledChange={setCameraEnabled}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
