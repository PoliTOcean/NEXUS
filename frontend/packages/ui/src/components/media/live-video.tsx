import { type ComponentPropsWithoutRef, type ReactNode, useEffect, useRef } from "react"

import type { UiStatus, VideoAspectRatio } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { StatusBadge } from "@politocean/ui/components/primitives/status-badge"

export type LiveVideoProps = Omit<ComponentPropsWithoutRef<"video">, "src" | "title"> & {
  title?: ReactNode
  status?: UiStatus
  stream?: MediaStream | null
  aspectRatio?: VideoAspectRatio
  fallback?: ReactNode
  overlay?: ReactNode
  showChrome?: boolean
  objectFit?: "cover" | "contain"
}

const aspectRatioClassName: Record<VideoAspectRatio, string> = {
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "21/9": "aspect-[21/9]",
}

export function LiveVideo({
  title,
  status,
  stream,
  aspectRatio = "16/9",
  fallback,
  overlay,
  showChrome = true,
  objectFit = "cover",
  className,
  autoPlay = true,
  muted = true,
  playsInline = true,
  ...props
}: LiveVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const resolvedStatus = status ?? (stream ? "online" : "offline")
  const mediaClassName = cn(
    "h-full w-full",
    objectFit === "contain" ? "object-contain" : "object-cover"
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.srcObject = stream ?? null

    return () => {
      video.srcObject = null
    }
  }, [stream])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-black text-white",
        aspectRatioClassName[aspectRatio],
        className
      )}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay={autoPlay}
          muted={muted}
          playsInline={playsInline}
          controls={false}
          className={mediaClassName}
          {...props}
        />
      ) : (
        <div
          className={cn(
            mediaClassName,
            "flex items-center justify-center bg-black text-sm text-white/60"
          )}
        >
          {fallback ?? "No signal"}
        </div>
      )}

      {showChrome && (title || resolvedStatus) && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          {title ? <div className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium backdrop-blur">{title}</div> : null}
          <StatusBadge status={resolvedStatus} label={resolvedStatus === "online" ? "Live" : undefined} />
        </div>
      )}

      {overlay ? <div className="pointer-events-none absolute inset-0">{overlay}</div> : null}
    </div>
  )
}
