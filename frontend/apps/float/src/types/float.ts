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
  syringe_u?: Array<number | string | null | undefined>
  syringe_position_u?: Array<number | string | null | undefined>
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

export type FloatRuntimeProfile = {
  profile_count: number
  descent_target_m: number
  ascent_target_m: number
  ascent_target_bottom_m?: number
  depth_tolerance_m: number
  hold_s: number
  descent_timeout_s: number
  ascent_timeout_s: number
  surface_rest_offset_m: number
}

export type NexusFloatProfileResponse = {
  code?: string
  status: boolean | number
  text: string
  data: FloatRuntimeProfile
}

export type FloatRuntimePidConfig = {
  kp: number
  ki: number
  kd: number
  period_ms: number
  alpha_d: number
  integral_limit: number
  min_retarget_frac: number
  u_neutral: number
}

export type FloatRuntimeBalanceConfig = {
  hold_ms: number
  stop_delta_kpa: number
  stop_samples: number
  sample_period_ms: number
}

export type FloatRuntimeMotorConfig = {
  max_speed: number
  max_accel: number
  homing_speed: number
  test_speed: number
}

export type NexusFloatConfigResponse<TData> = {
  code?: string
  status: boolean | number
  text: string
  data: TData
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
  runtimeProfile: FloatRuntimeProfile | null
  runtimeProfileStatus: string
  runtimePidConfig: FloatRuntimePidConfig | null
  runtimePidConfigStatus: string
  runtimeBalanceConfig: FloatRuntimeBalanceConfig | null
  runtimeBalanceConfigStatus: string
  runtimeMotorConfig: FloatRuntimeMotorConfig | null
  runtimeMotorConfigStatus: string
}
