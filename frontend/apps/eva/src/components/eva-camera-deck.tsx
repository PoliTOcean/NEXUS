import {
  CameraTile,
  LiveVideo,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  InstrumentPanel,
  ScrollArea,
  StatusBadge,
} from "@politocean/ui"

import { EvaAttitudeFloatingPanel } from "@/components/eva-attitude-floating-panel"
import { EvaFisheyeVideo } from "@/components/eva-fisheye-video"
import type { EvaCamera, EvaTelemetry } from "@/types/eva"

type EvaCameraDeckProps = {
  cameras: EvaCamera[]
  primaryCameraId: string
  telemetry: EvaTelemetry
  onSelectCamera: (cameraId: string) => void
  onCameraEnabledChange: (cameraId: string, enabled: boolean) => void
}

export function EvaCameraDeck({
  cameras,
  primaryCameraId,
  telemetry,
  onSelectCamera,
  onCameraEnabledChange,
}: EvaCameraDeckProps) {
  const primaryCamera =
    cameras.find((camera) => camera.id === primaryCameraId) ?? cameras[0]

  if (!primaryCamera) {
    return (
      <Panel className="min-h-0 border-0 bg-card/70">
        <PanelHeader className="p-3">
          <div className="flex items-center justify-between gap-3">
            <PanelTitle>Cameras</PanelTitle>
            <StatusBadge status="offline" label="Janus offline" />
          </div>
        </PanelHeader>
        <PanelContent className="flex min-h-0 flex-1 items-center justify-center p-6 pt-0">
          <div className="text-center">
            <p className="text-sm font-semibold">No camera streams</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Waiting for Janus streaming list.
            </p>
          </div>
        </PanelContent>
      </Panel>
    )
  }

  const secondaryCameras = cameras.filter(
    (camera) => camera.id !== primaryCamera.id
  )

  function renderCameraMedia(
    camera: EvaCamera,
    className: string,
    objectFit: "cover" | "contain"
  ) {
    const stream = camera.enabled ? camera.stream : null
    const fallback = camera.enabled ? "No signal" : "Disabled"

    if (camera.fisheye?.enabled) {
      return (
        <EvaFisheyeVideo
          title={camera.name}
          status={camera.status}
          stream={stream}
          aspectRatio={camera.aspectRatio}
          fallback={fallback}
          settings={camera.fisheye}
          className={className}
        />
      )
    }

    return (
      <LiveVideo
        title={camera.name}
        status={camera.status}
        stream={stream}
        aspectRatio={camera.aspectRatio}
        fallback={fallback}
        showChrome={false}
        objectFit={objectFit}
        className={className}
      />
    )
  }

  return (
    <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_150px] gap-3 overflow-hidden 2xl:grid-rows-[minmax(0,1fr)_170px]">
      <div className="relative min-h-0 overflow-hidden">
        <CameraTile
          name={primaryCamera.name}
          status={primaryCamera.status}
          stream={primaryCamera.stream}
          aspectRatio={primaryCamera.aspectRatio}
          selected
          enabled={primaryCamera.enabled}
          fallback="No signal"
          resolution={primaryCamera.resolution}
          fps={primaryCamera.fps}
          latencyMs={primaryCamera.latencyMs}
          metadata={primaryCamera.description}
          media={renderCameraMedia(
            primaryCamera,
            "mx-auto h-full w-auto max-w-full rounded-md border-0",
            "contain"
          )}
          onEnabledChange={(enabled) =>
            onCameraEnabledChange(primaryCamera.id, enabled)
          }
          chrome="overlay"
          videoObjectFit="contain"
          videoClassName="mx-auto h-full w-auto max-w-full border-0"
          className="h-full min-h-0 border-border/80 bg-card/70 p-1 shadow-sm"
        />

        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]">
          <InstrumentPanel
            heading={telemetry.heading ?? 0}
            roll={telemetry.roll ?? 0}
            pitch={telemetry.pitch ?? 0}
            compact
            showBattery={false}
            className="border-border/70 bg-card/70 text-card-foreground shadow-lg backdrop-blur-md [&_[data-slot=panel-content]]:gap-4 [&_[data-slot=panel-content]]:p-3 [&_[data-slot=panel-header]]:p-3 [&_[data-slot=panel-title]]:text-sm"
            contentClassName="flex-col items-stretch"
          />
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 top-3 flex max-w-[calc(100%-1.5rem)] items-end">
          <EvaAttitudeFloatingPanel telemetry={telemetry} />
        </div>
      </div>

      <ScrollArea className="min-h-0" type="always">
        <div className="grid h-full min-w-full auto-cols-[220px] grid-flow-col justify-center gap-3 2xl:auto-cols-[260px]">
          {secondaryCameras.map((camera) => (
            <CameraTile
              key={camera.id}
              name={camera.name}
              status={camera.status}
              stream={camera.stream}
              aspectRatio={camera.aspectRatio}
              enabled={camera.enabled}
              fallback="No signal"
              metadata={camera.description}
              media={renderCameraMedia(
                camera,
                "h-full w-full rounded-md border-0",
                "cover"
              )}
              onSelect={() => onSelectCamera(camera.id)}
              onEnabledChange={(enabled) =>
                onCameraEnabledChange(camera.id, enabled)
              }
              chrome="overlay"
              compact
              videoClassName="h-full w-full border-0"
              className="h-full min-h-0 border-border/80 bg-card/70 p-1 shadow-sm"
            />
          ))}
        </div>
      </ScrollArea>
    </section>
  )
}
