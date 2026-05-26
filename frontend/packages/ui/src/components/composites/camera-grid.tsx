import type { CameraItem } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { CameraTile } from "@politocean/ui/components/composites/camera-tile"

export type CameraGridProps = {
  cameras: CameraItem[]
  columns?: 1 | 2 | 3 | 4
  className?: string
}

const columnClassName: Record<NonNullable<CameraGridProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 xl:grid-cols-2",
  3: "grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 2xl:grid-cols-4",
}

export function CameraGrid({ cameras, columns = 2, className }: CameraGridProps) {
  return (
    <div className={cn("grid gap-4", columnClassName[columns], className)}>
      {cameras.map((camera) => (
        <CameraTile
          key={camera.id}
          name={camera.name}
          status={camera.status}
          stream={camera.stream}
          aspectRatio={camera.aspectRatio}
          selected={camera.selected}
          enabled={camera.enabled}
          fallback={camera.fallback}
          overlay={camera.overlay}
          latencyMs={camera.latencyMs}
          fps={camera.fps}
          resolution={camera.resolution}
          metadata={camera.metadata}
          onSelect={camera.onSelect}
          onEnabledChange={camera.onEnabledChange}
        />
      ))}
    </div>
  )
}
