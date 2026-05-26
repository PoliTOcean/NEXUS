import type { UiStatus, VideoAspectRatio } from "@politocean/ui"

export type EvaConnectionId = "backend" | "mqtt" | "janus" | "controller"

export type EvaConnectionState = {
  id: EvaConnectionId
  label: string
  status: UiStatus
  detail: string
}

export type EvaCamera = {
  id: string
  name: string
  description: string
  aspectRatio: VideoAspectRatio
  fisheye?: EvaFisheyeSettings | null
  enabled: boolean
  status: UiStatus
  resolution: string
  fps: number | null
  latencyMs: number | null
  stream: MediaStream | null
}

export type EvaFisheyeSettings = {
  enabled: boolean
  lens: number
  fov: number
}

export type EvaTelemetry = {
  heading: number | null
  roll: number | null
  pitch: number | null
  pitchReference: number | null
  absoluteAltitude: number | null
  relativeAltitude: number | null
  missionElapsedMs: number
}

export type EvaJoystickStatusId = "JOYSTICK"

export type EvaJoystickCommandStatusId =
  | "WORK"
  | "ARMED"
  | "TORQUE"
  | "DEPTH"
  | "ROLL"
  | "PITCH"

export type EvaJoystickStatusValue = "OK" | "OFF" | "READY" | "ACTIVE"

export type EvaJoystickStatus = {
  id: EvaJoystickStatusId
  label: string
  value: EvaJoystickStatusValue
  status: UiStatus
}

export type EvaJoystickCommandStatus = {
  id: EvaJoystickCommandStatusId
  label: string
  value: EvaJoystickStatusValue
  status: UiStatus
}

export type EvaMissionState = {
  cameras: EvaCamera[]
  connections: EvaConnectionState[]
  primaryCameraId: string
  telemetry: EvaTelemetry
  joystickStatus: EvaJoystickStatus
  joystickCommandStatuses: EvaJoystickCommandStatus[]
}

export type NexusInfo = {
  mode: string
  mqtt?: {
    ip?: string
    topics?: string[]
  }
  janus?: {
    ip?: string
    cameras?: NexusCameraInfo[]
    streams?: NexusCameraInfo[]
  }
  cameras?: NexusCameraInfo[]
  statuses?: string[]
}

export type NexusCameraInfo =
  | string
  | number
  | {
      id?: string | number
      name?: string
      description?: string
      aspectRatio?: VideoAspectRatio
      enabled?: boolean
      status?: UiStatus
      resolution?: string
      fps?: number | null
      latencyMs?: number | null
    }

export type NexusControllerStatus = {
  status: boolean | number
  isRunning: boolean | number
  code: string
}

export type NexusControllerState = Partial<
  Record<"DEPTH" | "ROLL" | "PITCH", EvaJoystickStatusValue>
>

export type NexusStatusPayload = {
  rov_armed?: EvaJoystickStatusValue
  work_mode?: EvaJoystickStatusValue
  torque_mode?: EvaJoystickStatusValue
  controller_state?: NexusControllerState
  depth?: number | string
  reference_z?: number | string
  roll?: number | string
  pitch?: number | string
  reference_pitch?: number | string
  yaw?: number | string
}
