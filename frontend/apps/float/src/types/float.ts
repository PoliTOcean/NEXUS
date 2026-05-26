import type { CommandAckStatus, LogItem, StatusItem, UiStatus } from "@politocean/ui/types"

export type FloatStatusKey =
  | "serial"
  | "ready"
  | "executing"
  | "dataAvailable"
  | "autoMode"
  | "wifi"
  | "battery"
  | "rssi"

export type FloatConnectionId = "backend" | "serial" | "ui"

export type FloatConnectionState = {
  id: FloatConnectionId
  label: string
  status: UiStatus
  detail: string
}

export type FloatFieldState = {
  label: string
  value: string
  status: UiStatus
  helperText?: string
}

export type FloatStatusState = Record<FloatStatusKey, FloatFieldState>

export type NexusFloatResponse = {
  code?: string
  status: boolean | number
  text: string
}

export type FloatProfileRawData = {
  times?: Array<number | string>
  time_s?: Array<number | string>
  depth?: Array<number | string>
  depth_m?: Array<number | string>
  pressure?: Array<number | string>
  pressure_kpa?: Array<number | string>
  profile_id?: Array<number | string | null | undefined>
  phase?: Array<string | null | undefined>
  sensor_depth_m?: Array<number | string | null | undefined>
  company_number?: string
}

export type FloatProfileData = {
  img?: string[] | "NO_DATA"
  raw?: FloatProfileRawData
  error_message?: string
}

export type NexusFloatListenResponse = {
  code?: string
  status: boolean | number
  data: FloatProfileData | ""
  text: string
}

export type FloatPackageState = {
  raw: string
  parsed: unknown | null
}

export type FloatProfileState = {
  statusText: string
  data: FloatProfileData | null
}

export type FloatAckState = {
  command?: string
  status?: CommandAckStatus
}

export type FloatMissionState = {
  connections: FloatConnectionState[]
  statusItems: StatusItem[]
  status: FloatStatusState
  dataAvailable: boolean
  lastAck: FloatAckState
  busyCommand: string | null
  logs: LogItem[]
  packageData: FloatPackageState | null
  profile: FloatProfileState
}
