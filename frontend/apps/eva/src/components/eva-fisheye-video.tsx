import { useCallback, useRef, useState, type ReactNode } from "react"

import { LiveVideo } from "@politocean/ui"
import type { UiStatus, VideoAspectRatio } from "@politocean/ui"
import { cn } from "@politocean/ui/lib/utils"

import { useFisheyeRenderer } from "@/hooks/use-fisheye-renderer"
import type { EvaFisheyeSettings } from "@/types/eva"

type EvaFisheyeVideoProps = {
  title: ReactNode
  status: UiStatus
  stream: MediaStream | null
  aspectRatio: VideoAspectRatio
  fallback: ReactNode
  settings: EvaFisheyeSettings
  className?: string
}

const aspectRatioClassName: Record<VideoAspectRatio, string> = {
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "21/9": "aspect-[21/9]",
}

export function EvaFisheyeVideo({
  title,
  status,
  stream,
  aspectRatio,
  fallback,
  settings,
  className,
}: EvaFisheyeVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [webglFailed, setWebglFailed] = useState(false)
  const handleRenderFailure = useCallback(() => {
    setWebglFailed(true)
  }, [])

  useFisheyeRenderer({
    videoRef,
    canvasRef,
    stream,
    settings,
    disabled: webglFailed,
    onFailure: handleRenderFailure,
  })

  if (!settings.enabled || webglFailed) {
    return (
      <LiveVideo
        title={title}
        status={status}
        stream={stream}
        aspectRatio={aspectRatio}
        fallback={fallback}
        showChrome={false}
        objectFit="contain"
        className={cn("rounded-md", className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-black text-white",
        aspectRatioClassName[aspectRatio],
        className
      )}
    >
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute size-px opacity-0"
          />
          <canvas ref={canvasRef} className="h-full w-full object-contain" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
          {fallback}
        </div>
      )}
    </div>
  )
}
