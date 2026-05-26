import type { ReactNode } from "react"

export type UiStatus =
  | "online"
  | "offline"
  | "loading"
  | "success"
  | "warning"
  | "error"
  | "unknown"

export type VideoAspectRatio = "16/9" | "4/3" | "21/9"

export type CommandIntent =
  | "default"
  | "primary"
  | "neutral"
  | "warning"
  | "danger"

export type AckState =
  | "none"
  | "pending"
  | "success"
  | "failed"
  | "timeout"

export type CommandAckStatus = AckState

export type LogLevel =
  | "debug"
  | "info"
  | "success"
  | "warning"
  | "error"

export type StatusItem = {
  id?: string
  label: string
  value: string | number | null
  status?: UiStatus
  description?: string
  helperText?: string
}

export type MetricItem = {
  id?: string
  label: string
  value: string | number | null
  unit?: string
  precision?: number
  status?: UiStatus
  helperText?: string
  icon?: ReactNode
}

export type CommandItem = {
  id?: string
  label: string
  intent?: CommandIntent
  disabled?: boolean
  busy?: boolean
  ack?: CommandAckStatus
  description?: string
  onClick?: () => void
}

export type ControlModeItem = {
  id?: string
  label: string
  active?: boolean
  status?: UiStatus
  description?: string
  disabled?: boolean
  onChange?: (active: boolean) => void
  onToggle?: (active: boolean) => void
}

export type CameraItem = {
  id: string
  name: string
  status?: UiStatus
  stream?: MediaStream | null
  aspectRatio?: VideoAspectRatio
  selected?: boolean
  enabled?: boolean
  fallback?: ReactNode
  overlay?: ReactNode
  latencyMs?: number
  fps?: number
  resolution?: string
  metadata?: ReactNode
  onSelect?: () => void
  onEnabledChange?: (enabled: boolean) => void
}

export type LogEntryItem = {
  id?: string
  timestamp?: string
  level?: LogLevel
  message: string
}

export type LogItem = LogEntryItem

export type DataViewerVariant = "plain" | "code" | "json" | "log"
