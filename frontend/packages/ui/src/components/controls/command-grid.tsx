import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@politocean/ui/lib/utils"

export type CommandGridProps = ComponentPropsWithoutRef<"div"> & {
  columns?: 1 | 2 | 3 | 4
}

const columnClassName: Record<NonNullable<CommandGridProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
}

export function CommandGrid({ columns = 2, className, ...props }: CommandGridProps) {
  return <div className={cn("grid gap-2", columnClassName[columns], className)} {...props} />
}
