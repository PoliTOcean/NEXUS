import type { ReactNode } from "react"

import { Switch } from "@politocean/ui/components/switch"
import { StatusDot } from "@politocean/ui/components/primitives/status-dot"
import type { UiStatus } from "@politocean/ui/types"
import { cn } from "@politocean/ui/lib/utils"

export type ControlToggleProps = {
  label: string
  description?: string
  active?: boolean
  status?: UiStatus
  disabled?: boolean
  icon?: ReactNode
  className?: string
  onChange?: (active: boolean) => void
}

export function ControlToggle({
  label,
  description,
  active = false,
  status,
  disabled = false,
  icon,
  className,
  onChange,
}: ControlToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!active)}
      className={cn(
        "group flex w-full items-center justify-between gap-4 rounded-md border bg-card p-4 text-left text-card-foreground transition",
        "hover:bg-accent/40",
        active && "border-primary/70 bg-primary/5",
        disabled && "cursor-not-allowed opacity-50 hover:bg-card",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </div>
        )}

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{label}</div>

          {description && (
            <div className="truncate text-xs text-muted-foreground">
              {description}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {status && <StatusDot status={status} pulse={status === "loading"} />}

        <Switch
          checked={active}
          disabled={disabled}
          onCheckedChange={onChange}
          onClick={(event) => event.stopPropagation()}
          aria-label={label}
        />
      </div>
    </button>
  )
}
