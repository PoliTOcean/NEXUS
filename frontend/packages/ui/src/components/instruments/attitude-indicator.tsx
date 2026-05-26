import { cn } from "@politocean/ui/lib/utils"

export type AttitudeIndicatorProps = {
  roll: number
  pitch: number
  className?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function AttitudeIndicator({
  roll,
  pitch,
  className,
}: AttitudeIndicatorProps) {
  const pitchOffset = clamp(pitch * 2, -35, 35)

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative size-40 overflow-hidden rounded-full border bg-sky-500/20">
        <div
          className="absolute left-1/2 top-1/2 size-[220%] origin-center"
          style={{
            transform: `translate(-50%, calc(-50% + ${pitchOffset}px)) rotate(${roll}deg)`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 bg-sky-500/30" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-amber-700/60" />

          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/70" />
        </div>

        <div className="absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 bg-foreground" />
        <div className="absolute left-1/2 top-1/2 h-6 w-px -translate-y-1/2 bg-foreground" />

        <div className="absolute inset-4 rounded-full border border-white/40" />
      </div>

      <div className="grid grid-cols-2 gap-4 font-mono text-sm tabular-nums">
        <span>R {roll.toFixed(1)}°</span>
        <span>P {pitch.toFixed(1)}°</span>
      </div>
    </div>
  )
}