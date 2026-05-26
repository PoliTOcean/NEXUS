import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@politocean/ui/lib/utils"

export function Panel({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("rounded-md border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
}

export function PanelHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-1.5 p-4", className)} {...props} />
}

export function PanelTitle({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return <h3 className={cn("text-sm font-semibold leading-none tracking-tight", className)} {...props} />
}

export function PanelDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />
}

export function PanelContent({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("p-4 pt-0", className)} {...props} />
}

export function PanelFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("flex items-center p-4 pt-0", className)} {...props} />
}
