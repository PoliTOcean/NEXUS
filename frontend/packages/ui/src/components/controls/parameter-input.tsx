import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { Input } from "@politocean/ui/components/input"
import { Label } from "@politocean/ui/components/label"
import { cn } from "@politocean/ui/lib/utils"

export type ParameterInputProps = ComponentPropsWithoutRef<typeof Input> & {
  label: ReactNode
  unit?: ReactNode
  helperText?: ReactNode
  action?: ReactNode
  rounding?: "default" | "full" | "left" | "right" | "none"
}

const roundingClassName: Record<NonNullable<ParameterInputProps["rounding"]>, string> = {
  default: "rounded-md",
  full: "rounded-md",
  left: "rounded-l-md rounded-r-none",
  right: "rounded-l-none rounded-r-md",
  none: "rounded-none",
}

const radiusClassName = "rounded-md"

export function ParameterInput({
  label,
  unit,
  helperText,
  action,
  rounding,
  className,
  id,
  ...props
}: ParameterInputProps) {
  const inputId = id ?? `parameter-${String(label).toLowerCase().replace(/\s+/g, "-")}`
  const resolvedRounding = rounding ?? (unit ? "left" : "default")

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <div className={cn("flex min-w-0 flex-1", radiusClassName)}>
          <Input
            id={inputId}
            className={cn(roundingClassName[resolvedRounding], className)}
            {...props}
          />
          {unit ? (
            <div className={cn("flex items-center border-l border-input bg-muted px-3 text-xs text-muted-foreground", "rounded-r-md")}>
              {unit}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {helperText ? <div className="text-xs text-muted-foreground">{helperText}</div> : null}
    </div>
  )
}
