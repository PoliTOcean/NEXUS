"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { ChartConfig } from "@politocean/ui/components/chart"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@politocean/ui/components/chart"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@politocean/ui/components/card"
import { Label } from "@politocean/ui/components/label"
import { ScrollArea } from "@politocean/ui/components/scroll-area"
import { Switch } from "@politocean/ui/components/switch"
import { EmptyState } from "@politocean/ui/components/primitives/empty-state"
import { cn } from "@politocean/ui/lib/utils"

export type FloatProfilePoint = {
  timestamp: string | number
  depth?: string | number | null | undefined
  pressure: string | number | null | undefined
  syringe?: string | number | null | undefined
}

export type FloatProfileChartProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  data: FloatProfilePoint[]
  depthUnit?: React.ReactNode
  pressureUnit?: React.ReactNode
  className?: string
  chartClassName?: string
  defaultRawView?: boolean
}

// Distinct hues so the three series stay readable in light and dark mode.
const SERIES_COLORS = {
  depth: "oklch(0.62 0.17 245)", // blue (water)
  pressure: "oklch(0.75 0.15 70)", // amber
  syringe: "oklch(0.68 0.17 150)", // green
} as const

const chartConfig = {
  depth: {
    label: "Depth",
    color: SERIES_COLORS.depth,
  },
  pressure: {
    label: "Pressure",
    color: SERIES_COLORS.pressure,
  },
  syringe: {
    label: "Syringe",
    color: SERIES_COLORS.syringe,
  },
} satisfies ChartConfig

function toNumber(value: FloatProfilePoint["pressure"]) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatTimestamp(value: string | number) {
  if (typeof value === "number") return String(value)
  return value.length > 12 ? value.slice(0, 12) : value
}

function formatPressure(value: number | null, unit: React.ReactNode) {
  const formatted = value === null ? "N/A" : value.toFixed(2)
  return unit ? `${formatted} ${unit}` : formatted
}

export function FloatProfileChart({
  title = "Float Profile",
  description = "Depth and pressure over timestamp",
  data,
  depthUnit = "m",
  pressureUnit = "Pa",
  className,
  chartClassName,
  defaultRawView = false,
}: FloatProfileChartProps) {
  const [rawView, setRawView] = React.useState(defaultRawView)
  const chartData = React.useMemo(
    () =>
      data.map((point) => ({
        timestamp: point.timestamp,
        depth: toNumber(point.depth),
        pressure: toNumber(point.pressure),
        syringe: toNumber(point.syringe),
      })),
    [data]
  )

  const hasData = chartData.some(
    (point) =>
      point.depth !== null || point.pressure !== null || point.syringe !== null
  )

  return (
    <Card className={cn("min-h-0 rounded-md", className)}>
      <CardHeader className="shrink-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Label htmlFor="pressure-profile-raw-view" className="text-xs">
            Raw chart
          </Label>
          <Switch
            id="pressure-profile-raw-view"
            size="sm"
            checked={rawView}
            onCheckedChange={setRawView}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {!hasData ? (
          <EmptyState title="No profile data" />
        ) : rawView ? (
          <ScrollArea className="h-full min-h-[220px] rounded-md border bg-muted/30">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="sticky top-0 bg-background/95 text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 font-medium">Time (s)</th>
                  <th className="px-3 py-2 font-medium">Depth</th>
                  <th className="px-3 py-2 font-medium">Pressure</th>
                  <th className="px-3 py-2 font-medium">Syringe</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((point, index) => (
                  <tr key={`${point.timestamp}-${index}`} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {point.timestamp}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {formatPressure(point.depth, depthUnit)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {formatPressure(point.pressure, pressureUnit)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {formatPressure(point.syringe, "u")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
            {/* Top chart: depth + pressure share the time axis but use their
                own Y scales (depth ~0-3 m, pressure ~95-125 kPa). The two charts
                split the panel ~3:2; min-h keeps each legible and lets the
                parent scroll only when the panel is very short. */}
            <div className="flex min-h-[150px] flex-[3] flex-col gap-2">
              <div className="shrink-0 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: SERIES_COLORS.depth }}
                  />
                  <span>Depth ({depthUnit})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: SERIES_COLORS.pressure }}
                  />
                  <span>Pressure ({pressureUnit})</span>
                </div>
              </div>
              <ChartContainer
                config={chartConfig}
                className={cn("min-h-0 flex-1 w-full", chartClassName)}
              >
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ left: 8, right: 12, top: 8, bottom: 4 }}
                  syncId="float-profile"
                >
                  <defs>
                    <linearGradient id="depthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-depth)"
                        stopOpacity={0.26}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-depth)"
                        stopOpacity={0.03}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={formatTimestamp}
                  />
                  <YAxis
                    yAxisId="depth"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={48}
                  />
                  <YAxis
                    yAxisId="pressure"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={58}
                    // Auto-scale around the actual pressure range. Pressure only
                    // swings a few kPa (~95-125), so a fixed [0, max] axis would
                    // flatten the curve; this lets it track depth visibly.
                    domain={["auto", "auto"]}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Area
                    yAxisId="depth"
                    dataKey="depth"
                    type="natural"
                    fill="url(#depthFill)"
                    stroke="var(--color-depth)"
                    strokeWidth={2}
                    connectNulls
                  />
                  <Area
                    yAxisId="pressure"
                    dataKey="pressure"
                    type="natural"
                    fill="transparent"
                    stroke="var(--color-pressure)"
                    strokeWidth={2.5}
                    strokeDasharray="5 3"
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            </div>

            {/* Bottom chart: syringe u on its own [0, 1] scale, so it never
                borrows the depth axis range and gets stretched. */}
            <div className="flex min-h-[120px] flex-[2] flex-col gap-2">
              <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: SERIES_COLORS.syringe }}
                />
                <span>Syringe (u)</span>
              </div>
              <ChartContainer
                config={chartConfig}
                className={cn("min-h-0 flex-1 w-full", chartClassName)}
              >
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ left: 8, right: 12, top: 8, bottom: 4 }}
                  syncId="float-profile"
                >
                  <defs>
                    <linearGradient id="syringeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-syringe)"
                        stopOpacity={0.26}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-syringe)"
                        stopOpacity={0.03}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={formatTimestamp}
                    label={{ value: "Time (s)", position: "insideBottom", offset: -2, fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="syringe"
                    domain={[0, 1]}
                    ticks={[0, 0.25, 0.5, 0.75, 1]}
                    tickFormatter={(value: number) => value.toFixed(2)}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={48}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Area
                    yAxisId="syringe"
                    dataKey="syringe"
                    type="natural"
                    fill="url(#syringeFill)"
                    stroke="var(--color-syringe)"
                    strokeWidth={2}
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export {
  FloatProfileChart as PressureProfileChart,
  type FloatProfileChartProps as PressureProfileChartProps,
  type FloatProfilePoint as PressureProfilePoint,
}
