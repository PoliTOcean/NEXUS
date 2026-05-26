import type { ReactNode } from "react"

import type { UiStatus, VideoAspectRatio } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"
import { LiveVideo } from "@politocean/ui/components/media/live-video"
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"
import { StatusBadge } from "@politocean/ui/components/primitives/status-badge"
import { Switch } from "@politocean/ui/components/switch"

export type CameraTileProps = {
  name: ReactNode
  status?: UiStatus
  stream?: MediaStream | null
  aspectRatio?: VideoAspectRatio
  selected?: boolean
  enabled?: boolean
  fallback?: ReactNode
  overlay?: ReactNode
  media?: ReactNode
  latencyMs?: number | null
  fps?: number | null
  resolution?: string | null
  metadata?: ReactNode
  onSelect?: () => void
  onEnabledChange?: (enabled: boolean) => void
  chrome?: "panel" | "overlay"
  compact?: boolean
  videoClassName?: string
  videoObjectFit?: "cover" | "contain"
  className?: string
}

export function CameraTile({
  name,
  status,
  stream,
  aspectRatio = "16/9",
  selected,
  enabled = true,
  fallback,
  overlay,
  media,
  latencyMs,
  fps,
  resolution,
  metadata,
  onSelect,
  onEnabledChange,
  chrome = "panel",
  compact,
  videoClassName,
  videoObjectFit,
  className,
}: CameraTileProps) {
  const resolvedStatus = !enabled ? "offline" : (status ?? (stream ? "online" : "offline"))
  const canSelect = enabled && onSelect

  function handleSelect() {
    if (!canSelect) return
    onSelect()
  }

  if (chrome === "overlay") {
    return (
      <Panel
        className={cn(
          "relative overflow-hidden transition-colors",
          !enabled && "opacity-60",
          canSelect && "cursor-pointer",
          className
        )}
        aria-pressed={selected}
        onClick={handleSelect}
        role={canSelect ? "button" : undefined}
        tabIndex={canSelect ? 0 : undefined}
        onKeyDown={(event) => {
          if (!canSelect) return
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          onSelect()
        }}
      >
        <PanelContent className="h-full min-h-0 p-0">
          {media ?? (
            <LiveVideo
              title={name}
              status={resolvedStatus}
              stream={enabled ? stream : null}
              aspectRatio={aspectRatio}
              fallback={enabled ? fallback : "Disabled"}
              overlay={overlay}
              showChrome={false}
              objectFit={videoObjectFit}
              className={cn(
                "rounded-md",
                videoClassName
              )}
            />
          )}
        </PanelContent>

        <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex max-w-full items-center rounded-md bg-black/65 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
              <span className="truncate">{name}</span>
            </div>
            {metadata ? (
              <div className="mt-1 truncate pl-2 text-xs text-white/70">
                {metadata}
              </div>
            ) : null}
            {resolution ? (
              <div className="mt-1 inline-flex max-w-full rounded-md bg-black/45 px-2 py-1 font-mono text-xs text-white/75 backdrop-blur">
                <span className="truncate">{resolution}</span>
              </div>
            ) : null}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-2">
            <StatusBadge
              status={resolvedStatus}
              label={resolvedStatus === "online" ? "Live" : undefined}
              className="bg-black/65 text-white"
            />
            {onEnabledChange ? (
              <Switch
                aria-label={`Toggle ${String(name)}`}
                checked={enabled}
                size="sm"
                onCheckedChange={onEnabledChange}
                onClick={(event) => event.stopPropagation()}
              />
            ) : null}
          </div>
        </div>

        {selected ? (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-end justify-end text-xs text-white/75">
            <div className="rounded border border-cyan-200/40 bg-black/45 px-2 py-1 font-mono text-[10px] uppercase text-cyan-100 backdrop-blur">
              Primary
            </div>
          </div>
        ) : null}
      </Panel>
    )
  }

  return (
    <Panel
      className={cn(
        "grid overflow-hidden transition-colors",
        compact ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)_auto]",
        selected && "border-primary ring-2 ring-primary/30",
        !enabled && "opacity-60",
        canSelect && "cursor-pointer hover:border-primary/70",
        className
      )}
      aria-pressed={selected}
      onClick={handleSelect}
      role={canSelect ? "button" : undefined}
      tabIndex={canSelect ? 0 : undefined}
      onKeyDown={(event) => {
        if (!canSelect) return
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onSelect()
      }}
    >
      <PanelHeader
        className={cn(
          "flex flex-row items-center justify-between gap-3 space-y-0",
          compact ? "p-2" : "p-3"
        )}
      >
        <div className="min-w-0">
          <PanelTitle className="truncate">{name}</PanelTitle>
          {metadata ? <div className="mt-1 text-xs text-muted-foreground">{metadata}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={resolvedStatus} label={resolvedStatus === "online" ? "Live" : undefined} />
          {onEnabledChange ? (
            <Switch
              aria-label={`Toggle ${String(name)}`}
              checked={enabled}
              size="sm"
              onCheckedChange={onEnabledChange}
              onClick={(event) => event.stopPropagation()}
            />
          ) : null}
        </div>
      </PanelHeader>
      <PanelContent className="min-h-0 p-0">
        {media ?? (
          <LiveVideo
            title={name}
            status={resolvedStatus}
            stream={enabled ? stream : null}
            aspectRatio={aspectRatio}
            fallback={enabled ? fallback : "Disabled"}
            overlay={overlay}
            objectFit={videoObjectFit}
            className={cn("rounded-none border-0", videoClassName)}
          />
        )}
      </PanelContent>
      {!compact && (latencyMs !== undefined || fps !== undefined || resolution || selected) && (
        <div className="flex flex-wrap gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
          {selected ? <span className="font-medium text-primary">Primary</span> : null}
          {resolution ? <span>{resolution}</span> : null}
          {fps !== undefined && fps !== null ? <span>{fps} FPS</span> : null}
          {latencyMs !== undefined && latencyMs !== null ? <span>{latencyMs} ms</span> : null}
        </div>
      )}
    </Panel>
  )
}
