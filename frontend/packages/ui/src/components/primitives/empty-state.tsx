import type { ReactNode } from "react"

import { cn } from "@politocean/ui/lib/utils"

export type EmptyStateProps = {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title = "No data", description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex min-h-32 flex-col items-center justify-center rounded-md border border-dashed p-6 text-center", className)}>
      <div className="text-sm font-medium">{title}</div>
      {description ? <div className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
