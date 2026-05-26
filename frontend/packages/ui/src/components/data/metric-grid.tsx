import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@politocean/ui/lib/utils"

export type MetricGridProps = ComponentPropsWithoutRef<"div"> & {
  columns?: 1 | 2 | 3 | 4
}

const columnClassName: Record<NonNullable<MetricGridProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
}

export function MetricGrid({ columns = 4, className, ...props }: MetricGridProps) {
  return <div className={cn("grid gap-3", columnClassName[columns], className)} {...props} />
}
