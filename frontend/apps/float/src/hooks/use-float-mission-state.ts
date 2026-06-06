import { useCallback, useEffect, useMemo, useState } from "react"
import type { CommandItem, LogItem, StatusItem, UiStatus } from "@politocean/ui/types"

import {
  getFloatBalanceConfig,
  getFloatMotorConfig,
  getFloatPidConfig,
  getFloatProfile,
  getFloatStatus,
  listenFloatProfile,
  sendFloatCommand,
  setFloatBalanceConfig,
  setFloatMotorConfig,
  setFloatPidConfig,
  setFloatProfile,
  setFloatSyringe,
  startFloat,
} from "@/lib/nexus-client"
import type {
  FloatConnectionState,
  FloatMissionState,
  FloatPackageState,
  FloatRuntimeBalanceConfig,
  FloatRuntimeMotorConfig,
  FloatRuntimePidConfig,
  FloatRuntimeProfile,
  FloatStatusKey,
  FloatStatusState,
  NexusFloatResponse,
} from "@/types/float"

const FLOAT_TARGET_DEPTH = 2.5
const FLOAT_MAX_ERROR = 0.33
const MAX_LOG_CHARS = 5000
const PROFILE_POLL_ATTEMPTS = 40
const PROFILE_POLL_DELAY_MS = 250

const FLOAT_LENGTH_M = 0.51
const SYRINGE_DURATION_MIN_S = 0.5
const SYRINGE_DURATION_MAX_S = 300

const DEFAULT_RUNTIME_PROFILE: FloatRuntimeProfile = {
  profile_count: 2,
  descent_target_m: 2.5,
  ascent_target_m: 0.4,
  ascent_target_bottom_m: 0.91,
  depth_tolerance_m: 0.33,
  hold_s: 30,
  descent_timeout_s: 180,
  ascent_timeout_s: 120,
  surface_rest_offset_m: 0.1,
}

const DEFAULT_RUNTIME_PID_CONFIG: FloatRuntimePidConfig = {
  kp: 0.17,
  ki: 0,
  kd: 0.13,
  period_ms: 50,
  alpha_d: 0.25,
  integral_limit: 5,
  min_retarget_frac: 0.001,
  u_neutral: 0.011,
}

const DEFAULT_RUNTIME_BALANCE_CONFIG: FloatRuntimeBalanceConfig = {
  hold_ms: 5000,
  stop_delta_kpa: 5,
  stop_samples: 3,
  sample_period_ms: 50,
}

const DEFAULT_RUNTIME_MOTOR_CONFIG: FloatRuntimeMotorConfig = {
  max_speed: 1800,
  max_accel: 1800,
  homing_speed: 1800,
  test_speed: 1800,
}

const COMMANDS = [
  { id: "GO", label: "GO", description: "2 profiles" },
  { id: "BALANCE", label: "BALANCE" },
  { id: "CLEAR_SD", label: "CLEAR MEMORY", intent: "warning" },
  { id: "SWITCH_AUTO_MODE", label: "TOGGLE AUTO" },
  { id: "SEND_PACKAGE", label: "SEND PACKAGE" },
  { id: "TRY_UPLOAD", label: "OTA UPLOAD" },
  { id: "HOME_MOTOR", label: "HOME MOTOR" },
  { id: "STOP", label: "STOP", description: "Emergency stop", intent: "danger" },
] satisfies Array<Pick<CommandItem, "id" | "label" | "description" | "intent">>

const INITIAL_CONNECTIONS: FloatConnectionState[] = [
  { id: "backend", label: "Backend", status: "loading", detail: "Connecting" },
  { id: "serial", label: "Serial", status: "offline", detail: "Waiting" },
  { id: "ui", label: "UI", status: "success", detail: "Ready" },
]

const INITIAL_STATUS: FloatStatusState = {
  serial: { label: "Serial", value: "OFF", status: "offline" },
  ready: { label: "Ready", value: "OFF", status: "offline" },
  executing: { label: "Executing", value: "OFF", status: "offline" },
  dataAvailable: { label: "Data Avail", value: "OFF", status: "offline" },
  autoMode: { label: "Auto Mode", value: "OFF", status: "offline" },
  wifi: { label: "WiFi Conn", value: "OFF", status: "offline" },
  battery: { label: "Battery", value: "N/A", status: "unknown" },
  rssi: { label: "RSSI", value: "N/A", status: "unknown" },
}

function isSuccessStatus(response: Pick<NexusFloatResponse, "status">) {
  return response.status === true || response.status === 1
}

function appendBoundedLog(logs: LogItem[], item: LogItem) {
  const nextLogs = [...logs, item]
  let totalChars = nextLogs.reduce((sum, log) => sum + log.message.length, 0)

  while (totalChars > MAX_LOG_CHARS && nextLogs.length > 1) {
    const removed = nextLogs.shift()
    totalChars -= removed?.message.length ?? 0
  }

  return nextLogs
}

function updateConnection(
  connections: FloatConnectionState[],
  id: FloatConnectionState["id"],
  status: UiStatus,
  detail: string
) {
  return connections.map((connection) =>
    connection.id === id ? { ...connection, status, detail } : connection
  )
}

function withStatus(
  status: FloatStatusState,
  key: FloatStatusKey,
  value: string,
  uiStatus: UiStatus,
  helperText?: string
) {
  return {
    ...status,
    [key]: {
      ...status[key],
      value,
      status: uiStatus,
      helperText,
    },
  }
}

function parseFloatStatusText(statusText: string) {
  const parts = statusText
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)

  let nextStatus = INITIAL_STATUS
  let dataAvailable = false
  let serialStatus: UiStatus = "offline"
  let serialDetail = "Waiting"
  const warnings: string[] = []

  for (const part of parts) {
    if (part === "CONNECTED") {
      nextStatus = withStatus(nextStatus, "serial", "CONNECTED", "success")
      nextStatus = withStatus(nextStatus, "ready", "READY", "success")
      nextStatus = withStatus(nextStatus, "executing", "IDLE", "offline")
      serialStatus = "success"
      serialDetail = "Connected"
      continue
    }

    if (part === "CONNECTED_W_DATA") {
      nextStatus = withStatus(nextStatus, "serial", "CONNECTED", "success")
      nextStatus = withStatus(nextStatus, "ready", "READY", "success")
      nextStatus = withStatus(nextStatus, "dataAvailable", "YES", "success")
      nextStatus = withStatus(nextStatus, "executing", "IDLE (DATA)", "offline")
      dataAvailable = true
      serialStatus = "success"
      serialDetail = "Connected"
      continue
    }

    if (part === "EXECUTING_CMD") {
      nextStatus = withStatus(nextStatus, "executing", "BUSY", "loading")
      nextStatus = withStatus(nextStatus, "dataAvailable", "NO", "offline")
      dataAvailable = false
      continue
    }

    if (part === "AUTO_MODE_YES") {
      nextStatus = withStatus(nextStatus, "autoMode", "ON", "success")
      continue
    }

    if (part === "AUTO_MODE_NO") {
      nextStatus = withStatus(nextStatus, "autoMode", "OFF", "offline")
      continue
    }

    if (part === "CONN_OK") {
      nextStatus = withStatus(nextStatus, "wifi", "OK", "success")
      continue
    }

    if (part === "CONN_LOST") {
      nextStatus = withStatus(nextStatus, "wifi", "LOST", "error")
      continue
    }

    if (part.startsWith("BATTERY:")) {
      const value = part.split(":")[1]?.trim() ?? "N/A"
      nextStatus = withStatus(nextStatus, "battery", `${value} mV`, "unknown")
      continue
    }

    if (part.startsWith("RSSI:")) {
      const value = part.split(":")[1]?.trim() ?? "N/A"
      nextStatus = withStatus(nextStatus, "rssi", `${value} dBm`, "unknown")
      continue
    }

    if (part === "NO USB" || part === "DISCONNECTED") {
      nextStatus = withStatus(nextStatus, "serial", part, "error")
      nextStatus = withStatus(nextStatus, "ready", "OFF", "offline")
      nextStatus = withStatus(nextStatus, "executing", "N/A", "unknown")
      nextStatus = withStatus(nextStatus, "dataAvailable", "N/A", "offline")
      nextStatus = withStatus(nextStatus, "wifi", "N/A", "unknown")
      dataAvailable = false
      serialStatus = "error"
      serialDetail = part
      continue
    }

    if (part.startsWith("TIMEOUT_ON_")) {
      warnings.push(part)
      continue
    }
  }

  if (!dataAvailable && nextStatus.dataAvailable.value === "OFF") {
    nextStatus = withStatus(nextStatus, "dataAvailable", "NO", "offline")
  }

  return {
    status: nextStatus,
    dataAvailable,
    serialConnection: {
      status: serialStatus,
      detail: serialDetail,
    },
    warnings,
  }
}

function parsePackageData(raw: string): FloatPackageState {
  try {
    return {
      raw,
      parsed: JSON.parse(raw) as unknown,
    }
  } catch {
    return {
      raw,
      parsed: null,
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function validateRuntimeProfile(profile: FloatRuntimeProfile) {
  const ascentBottom = profile.ascent_target_m + FLOAT_LENGTH_M

  if (profile.profile_count < 1 || profile.profile_count > 10) {
    return "Profile count must be between 1 and 10."
  }
  if (profile.descent_target_m < 0 || profile.descent_target_m > 5) {
    return "Descent target must be between 0 and 5 m."
  }
  if (profile.ascent_target_m < 0 || profile.ascent_target_m > 5) {
    return "Ascent target must be between 0 and 5 m."
  }
  if (profile.depth_tolerance_m < 0.005 || profile.depth_tolerance_m > 1) {
    return "Depth tolerance must be between 0.005 and 1 m."
  }
  if (profile.hold_s < 1 || profile.hold_s > 600) {
    return "Hold time must be between 1 and 600 s."
  }
  if (profile.descent_timeout_s < 5 || profile.descent_timeout_s > 900) {
    return "Descent timeout must be between 5 and 900 s."
  }
  if (profile.ascent_timeout_s < 5 || profile.ascent_timeout_s > 900) {
    return "Ascent timeout must be between 5 and 900 s."
  }
  if (profile.surface_rest_offset_m < 0 || profile.surface_rest_offset_m > 5) {
    return "Surface rest offset must be between 0 and 5 m."
  }
  if (ascentBottom >= profile.descent_target_m) {
    return "Ascent target + 0.51 m (float length) must be lower than the descent target."
  }

  return null
}

function validateRuntimePidConfig(config: FloatRuntimePidConfig) {
  for (const [field, value] of Object.entries({
    kp: config.kp,
    ki: config.ki,
    kd: config.kd,
  })) {
    if (!Number.isFinite(value)) return `${field} must be finite.`
  }
  if (config.period_ms < 20 || config.period_ms > 500) {
    return "PID period must be between 20 and 500 ms."
  }
  if (config.alpha_d < 0.05 || config.alpha_d > 1) {
    return "Derivative alpha must be between 0.05 and 1."
  }
  if (!Number.isFinite(config.integral_limit) || config.integral_limit <= 0) {
    return "Integral limit must be greater than 0."
  }
  if (!Number.isFinite(config.min_retarget_frac) || config.min_retarget_frac < 0) {
    return "Min retarget fraction must be 0 or greater."
  }
  if (!Number.isFinite(config.u_neutral) || config.u_neutral < 0) {
    return "Neutral output must be 0 or greater."
  }
  return null
}

function validateRuntimeBalanceConfig(config: FloatRuntimeBalanceConfig) {
  if (config.hold_ms < 0 || config.hold_ms > 60000) {
    return "Balance hold must be between 0 and 60000 ms."
  }
  if (config.stop_delta_kpa < 0.1 || config.stop_delta_kpa > 50) {
    return "Stop delta must be between 0.1 and 50 kPa."
  }
  if (config.stop_samples < 1 || config.stop_samples > 20) {
    return "Stop samples must be between 1 and 20."
  }
  if (config.sample_period_ms < 20 || config.sample_period_ms > 1000) {
    return "Sample period must be between 20 and 1000 ms."
  }
  return null
}

function validateRuntimeMotorConfig(config: FloatRuntimeMotorConfig) {
  for (const [field, value] of Object.entries({
    max_speed: config.max_speed,
    homing_speed: config.homing_speed,
    test_speed: config.test_speed,
  })) {
    if (value < 10 || value > 5000) return `${field} must be between 10 and 5000.`
  }
  if (config.max_accel < 10 || config.max_accel > 10000) {
    return "Max acceleration must be between 10 and 10000."
  }
  return null
}

export function isDepthNearTarget(depth: number) {
  return Math.abs(depth - FLOAT_TARGET_DEPTH) <= FLOAT_MAX_ERROR
}

export function useFloatMissionState() {
  const [connections, setConnections] =
    useState<FloatConnectionState[]>(INITIAL_CONNECTIONS)
  const [status, setStatus] = useState<FloatStatusState>(INITIAL_STATUS)
  const [dataAvailable, setDataAvailable] = useState(false)
  const [lastAck, setLastAck] = useState<FloatMissionState["lastAck"]>({})
  const [busyCommand, setBusyCommand] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [packageData, setPackageData] = useState<FloatPackageState | null>(null)
  const [runtimeProfile, setRuntimeProfile] =
    useState<FloatRuntimeProfile | null>(null)
  const [runtimeProfileStatus, setRuntimeProfileStatus] =
    useState("Profile not loaded yet.")
  const [runtimePidConfig, setRuntimePidConfig] =
    useState<FloatRuntimePidConfig | null>(null)
  const [runtimePidConfigStatus, setRuntimePidConfigStatus] =
    useState("PID config not loaded yet.")
  const [runtimeBalanceConfig, setRuntimeBalanceConfig] =
    useState<FloatRuntimeBalanceConfig | null>(null)
  const [runtimeBalanceConfigStatus, setRuntimeBalanceConfigStatus] =
    useState("Balance config not loaded yet.")
  const [runtimeMotorConfig, setRuntimeMotorConfig] =
    useState<FloatRuntimeMotorConfig | null>(null)
  const [runtimeMotorConfigStatus, setRuntimeMotorConfigStatus] =
    useState("Motor config not loaded yet.")
  const [profile, setProfile] = useState<FloatMissionState["profile"]>({
    statusText: "No profile data fetched yet.",
    data: null,
  })

  const addLog = useCallback(
    (message: string, level: LogItem["level"] = "info") => {
      const timestamp = new Date().toLocaleTimeString()
      const logItem: LogItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp,
        level,
        message,
      }

      setLogs((currentLogs) => appendBoundedLog(currentLogs, logItem))
    },
    []
  )

  const applyStatusText = useCallback(
    (statusText: string) => {
      addLog(`Raw Status: ${statusText}`)
      const parsed = parseFloatStatusText(statusText)

      setStatus(parsed.status)
      setDataAvailable(parsed.dataAvailable)
      setConnections((currentConnections) =>
        updateConnection(
          currentConnections,
          "serial",
          parsed.serialConnection.status,
          parsed.serialConnection.detail
        )
      )

      for (const warning of parsed.warnings) {
        addLog(`Warning: ESPB reported timeout on command: ${warning}`, "warning")
      }
    },
    [addLog]
  )

  const pollStatus = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await getFloatStatus(signal)
        setConnections((currentConnections) =>
          updateConnection(currentConnections, "backend", "success", "Online")
        )

        if (isSuccessStatus(response)) {
          applyStatusText(response.text)
          return
        }

        addLog(`Status poll failed: ${response.text}`, "error")
        applyStatusText("NO USB")
      } catch (error) {
        if (signal?.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        addLog(`Network error polling status: ${message}`, "error")
        setConnections((currentConnections) =>
          updateConnection(currentConnections, "backend", "error", "Offline")
        )
        applyStatusText("NO USB")
      }
    },
    [addLog, applyStatusText]
  )

  const refreshRuntimeProfile = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await getFloatProfile(signal)
        setRuntimeProfile(response.data ?? DEFAULT_RUNTIME_PROFILE)

        if (isSuccessStatus(response)) {
          setRuntimeProfileStatus("Loaded profile from ESPA.")
          addLog("Runtime profile loaded from ESPA.", "success")
        } else {
          setRuntimeProfileStatus("Loaded cached profile; ESPA did not answer.")
          addLog(`Runtime profile cache loaded: ${response.text}`, "warning")
        }
      } catch (error) {
        if (signal?.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setRuntimeProfile(DEFAULT_RUNTIME_PROFILE)
        setRuntimeProfileStatus("Could not load profile; using UI defaults.")
        addLog(`Runtime profile load failed: ${message}`, "error")
      }
    },
    [addLog]
  )

  const applyRuntimeProfile = useCallback(
    async (nextProfile: FloatRuntimeProfile) => {
      const validationError = validateRuntimeProfile(nextProfile)
      if (validationError) {
        setRuntimeProfileStatus(validationError)
        addLog(`Profile not sent: ${validationError}`, "warning")
        return false
      }

      setBusyCommand("PROFILE_SET")
      setRuntimeProfileStatus("Sending profile to ESPA...")
      addLog("Sending runtime profile to ESPA...")

      try {
        const response = await setFloatProfile({
          ...nextProfile,
          ascent_target_bottom_m: nextProfile.ascent_target_m + FLOAT_LENGTH_M,
        })

        if (!isSuccessStatus(response)) {
          setRuntimeProfileStatus(response.text)
          addLog(`Runtime profile rejected: ${response.text}`, "error")
          return false
        }

        setRuntimeProfile(response.data)
        setRuntimeProfileStatus("Profile applied and saved on ESPA.")
        addLog("Runtime profile applied and saved on ESPA.", "success")
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setRuntimeProfileStatus(message)
        addLog(`Runtime profile apply failed: ${message}`, "error")
        return false
      } finally {
        setBusyCommand(null)
      }
    },
    [addLog]
  )

  const refreshRuntimePidConfig = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await getFloatPidConfig(signal)
        setRuntimePidConfig(response.data ?? DEFAULT_RUNTIME_PID_CONFIG)

        if (isSuccessStatus(response)) {
          setRuntimePidConfigStatus("Loaded PID config from ESPA.")
          addLog("Runtime PID config loaded from ESPA.", "success")
        } else {
          setRuntimePidConfigStatus("Loaded cached PID config.")
          addLog(`Runtime PID config cache loaded: ${response.text}`, "warning")
        }
      } catch (error) {
        if (signal?.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setRuntimePidConfig(DEFAULT_RUNTIME_PID_CONFIG)
        setRuntimePidConfigStatus("Could not load PID config; using UI defaults.")
        addLog(`Runtime PID config load failed: ${message}`, "error")
      }
    },
    [addLog]
  )

  const applyRuntimePidConfig = useCallback(
    async (nextConfig: FloatRuntimePidConfig) => {
      const validationError = validateRuntimePidConfig(nextConfig)
      if (validationError) {
        setRuntimePidConfigStatus(validationError)
        addLog(`PID config not sent: ${validationError}`, "warning")
        return false
      }

      setBusyCommand("PID_CONFIG_SET")
      setRuntimePidConfigStatus("Sending PID config to ESPA...")
      addLog("Sending runtime PID config to ESPA...")

      try {
        const response = await setFloatPidConfig(nextConfig)
        if (!isSuccessStatus(response)) {
          setRuntimePidConfigStatus(response.text)
          addLog(`Runtime PID config rejected: ${response.text}`, "error")
          return false
        }

        setRuntimePidConfig(response.data)
        setRuntimePidConfigStatus("PID config applied and saved on ESPA.")
        addLog("Runtime PID config applied and saved on ESPA.", "success")
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setRuntimePidConfigStatus(message)
        addLog(`Runtime PID config apply failed: ${message}`, "error")
        return false
      } finally {
        setBusyCommand(null)
      }
    },
    [addLog]
  )

  const refreshRuntimeBalanceConfig = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await getFloatBalanceConfig(signal)
        setRuntimeBalanceConfig(response.data ?? DEFAULT_RUNTIME_BALANCE_CONFIG)

        if (isSuccessStatus(response)) {
          setRuntimeBalanceConfigStatus("Loaded balance config from ESPA.")
          addLog("Runtime balance config loaded from ESPA.", "success")
        } else {
          setRuntimeBalanceConfigStatus("Loaded cached balance config.")
          addLog(`Runtime balance config cache loaded: ${response.text}`, "warning")
        }
      } catch (error) {
        if (signal?.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setRuntimeBalanceConfig(DEFAULT_RUNTIME_BALANCE_CONFIG)
        setRuntimeBalanceConfigStatus("Could not load balance config; using UI defaults.")
        addLog(`Runtime balance config load failed: ${message}`, "error")
      }
    },
    [addLog]
  )

  const applyRuntimeBalanceConfig = useCallback(
    async (nextConfig: FloatRuntimeBalanceConfig) => {
      const validationError = validateRuntimeBalanceConfig(nextConfig)
      if (validationError) {
        setRuntimeBalanceConfigStatus(validationError)
        addLog(`Balance config not sent: ${validationError}`, "warning")
        return false
      }

      setBusyCommand("BALANCE_CONFIG_SET")
      setRuntimeBalanceConfigStatus("Sending balance config to ESPA...")
      addLog("Sending runtime balance config to ESPA...")

      try {
        const response = await setFloatBalanceConfig(nextConfig)
        if (!isSuccessStatus(response)) {
          setRuntimeBalanceConfigStatus(response.text)
          addLog(`Runtime balance config rejected: ${response.text}`, "error")
          return false
        }

        setRuntimeBalanceConfig(response.data)
        setRuntimeBalanceConfigStatus("Balance config applied and saved on ESPA.")
        addLog("Runtime balance config applied and saved on ESPA.", "success")
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setRuntimeBalanceConfigStatus(message)
        addLog(`Runtime balance config apply failed: ${message}`, "error")
        return false
      } finally {
        setBusyCommand(null)
      }
    },
    [addLog]
  )

  const refreshRuntimeMotorConfig = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await getFloatMotorConfig(signal)
        setRuntimeMotorConfig(response.data ?? DEFAULT_RUNTIME_MOTOR_CONFIG)

        if (isSuccessStatus(response)) {
          setRuntimeMotorConfigStatus("Loaded motor config from ESPA.")
          addLog("Runtime motor config loaded from ESPA.", "success")
        } else {
          setRuntimeMotorConfigStatus("Loaded cached motor config.")
          addLog(`Runtime motor config cache loaded: ${response.text}`, "warning")
        }
      } catch (error) {
        if (signal?.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        setRuntimeMotorConfig(DEFAULT_RUNTIME_MOTOR_CONFIG)
        setRuntimeMotorConfigStatus("Could not load motor config; using UI defaults.")
        addLog(`Runtime motor config load failed: ${message}`, "error")
      }
    },
    [addLog]
  )

  const applyRuntimeMotorConfig = useCallback(
    async (nextConfig: FloatRuntimeMotorConfig) => {
      const validationError = validateRuntimeMotorConfig(nextConfig)
      if (validationError) {
        setRuntimeMotorConfigStatus(validationError)
        addLog(`Motor config not sent: ${validationError}`, "warning")
        return false
      }

      setBusyCommand("MOTOR_CONFIG_SET")
      setRuntimeMotorConfigStatus("Sending motor config to ESPA...")
      addLog("Sending runtime motor config to ESPA...")

      try {
        const response = await setFloatMotorConfig(nextConfig)
        if (!isSuccessStatus(response)) {
          setRuntimeMotorConfigStatus(response.text)
          addLog(`Runtime motor config rejected: ${response.text}`, "error")
          return false
        }

        setRuntimeMotorConfig(response.data)
        setRuntimeMotorConfigStatus("Motor config applied and saved on ESPA.")
        addLog("Runtime motor config applied and saved on ESPA.", "success")
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setRuntimeMotorConfigStatus(message)
        addLog(`Runtime motor config apply failed: ${message}`, "error")
        return false
      } finally {
        setBusyCommand(null)
      }
    },
    [addLog]
  )

  useEffect(() => {
    const controller = new AbortController()

    async function initialize() {
      addLog(
        `Loaded float config: Target Depth=${FLOAT_TARGET_DEPTH}, Max Error=${FLOAT_MAX_ERROR}`
      )
      addLog("Attempting initial float serial connection...")

      try {
        const response = await startFloat(controller.signal)
        setConnections((currentConnections) =>
          updateConnection(currentConnections, "backend", "success", "Online")
        )

        if (isSuccessStatus(response)) {
          addLog(`Float connection successful: ${response.text}`, "success")
          applyStatusText(response.text)
          void refreshRuntimeProfile(controller.signal)
          void refreshRuntimePidConfig(controller.signal)
          void refreshRuntimeBalanceConfig(controller.signal)
          void refreshRuntimeMotorConfig(controller.signal)
          return
        }

        addLog(`Failed to connect to float: ${response.text}`, "error")
        applyStatusText(response.text)
        void refreshRuntimeProfile(controller.signal)
        void refreshRuntimePidConfig(controller.signal)
        void refreshRuntimeBalanceConfig(controller.signal)
        void refreshRuntimeMotorConfig(controller.signal)
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        addLog(`Network error during initial float connection: ${message}`, "error")
        setConnections((currentConnections) =>
          updateConnection(currentConnections, "backend", "error", "Offline")
        )
        applyStatusText("NO USB")
        void refreshRuntimeProfile(controller.signal)
        void refreshRuntimePidConfig(controller.signal)
        void refreshRuntimeBalanceConfig(controller.signal)
        void refreshRuntimeMotorConfig(controller.signal)
      }
    }

    void initialize()
    const intervalId = window.setInterval(() => {
      void pollStatus(controller.signal)
    }, 3000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [
    addLog,
    applyStatusText,
    pollStatus,
    refreshRuntimeBalanceConfig,
    refreshRuntimeMotorConfig,
    refreshRuntimePidConfig,
    refreshRuntimeProfile,
  ])

  const runCommand = useCallback(
    async (command: string) => {
      setBusyCommand(command)
      setLastAck({ command, status: "pending" })
      addLog(`Sending command: ${command}`)

      try {
        const response = await sendFloatCommand(command)
        const success = isSuccessStatus(response)

        if (!success) {
          setLastAck({ command, status: "failed" })
          addLog(`${command} failed: ${response.text}`, "error")
          return null
        }

        setLastAck({ command, status: "success" })
        addLog(`${command} successful: ${response.text}`, "success")

        if (command === "SEND_PACKAGE") {
          setPackageData(parsePackageData(response.text))
        }

        return response
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setLastAck({ command, status: "failed" })
        addLog(`${command} failed: ${message}`, "error")
        return null
      } finally {
        setBusyCommand(null)
      }
    },
    [addLog]
  )

  const sendTestSteps = useCallback(
    (steps: string) => {
      if (!steps) {
        addLog("Test steps command skipped: value is required.", "warning")
        return
      }

      void runCommand(`TEST_STEPS ${steps}`)
    },
    [addLog, runCommand]
  )

  const applySyringe = useCallback(
    async (uNorm: number, durationS: number) => {
      if (!Number.isFinite(uNorm) || !Number.isFinite(durationS)) {
        addLog("Syringe command skipped: position and duration are required.", "warning")
        return false
      }
      if (durationS < SYRINGE_DURATION_MIN_S || durationS > SYRINGE_DURATION_MAX_S) {
        const message = `ERR: durationS in [${SYRINGE_DURATION_MIN_S}, ${SYRINGE_DURATION_MAX_S}]`
        addLog(`Syringe command not sent: ${message}`, "warning")
        return false
      }

      // The firmware clamps u_norm to [0, 1]; clamp here too for a clear command.
      const clampedU = Math.min(1, Math.max(0, uNorm))

      setBusyCommand("SYRINGE_SET")
      setLastAck({ command: "SYRINGE_SET", status: "pending" })
      addLog(`Sending SYRINGE_SET ${clampedU} ${durationS}...`)

      try {
        const response = await setFloatSyringe(clampedU, durationS)
        if (!isSuccessStatus(response)) {
          setLastAck({ command: "SYRINGE_SET", status: "failed" })
          addLog(`SYRINGE_SET failed: ${response.text}`, "error")
          return false
        }
        setLastAck({ command: "SYRINGE_SET", status: "success" })
        addLog(`SYRINGE_SET successful: ${response.text}`, "success")
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setLastAck({ command: "SYRINGE_SET", status: "failed" })
        addLog(`SYRINGE_SET failed: ${message}`, "error")
        return false
      } finally {
        setBusyCommand(null)
      }
    },
    [addLog]
  )

  const fetchProfileData = useCallback(async () => {
    setBusyCommand("FETCH_PROFILE")
    setProfile({
      statusText: "Sending LISTENING command...",
      data: null,
    })
    setLastAck({ command: "LISTENING", status: "pending" })
    addLog("Attempting to fetch profile data...")

    try {
      const listenCommand = await sendFloatCommand("LISTENING")
      if (!isSuccessStatus(listenCommand)) {
        setLastAck({ command: "LISTENING", status: "failed" })
        setProfile({
          statusText: "Failed to send LISTENING command. Cannot fetch data.",
          data: null,
        })
        addLog(`LISTENING failed: ${listenCommand.text}`, "error")
        return
      }

      setLastAck({ command: "LISTENING", status: "success" })
      setProfile({
        statusText: "Fetching data from backend...",
        data: null,
      })
      addLog("Calling /FLOAT/listen endpoint...")

      for (let attempt = 0; attempt < PROFILE_POLL_ATTEMPTS; attempt += 1) {
        const response = await listenFloatProfile()
        addLog(`/FLOAT/listen response: Status ${response.status}, Text: ${response.text}`)

        if (isSuccessStatus(response) && response.text === "FINISHED") {
          setProfile({
            statusText: "Data received and processed.",
            data: response.data || null,
          })
          setStatus((currentStatus) =>
            withStatus(currentStatus, "dataAvailable", "FETCHED", "success")
          )
          setDataAvailable(false)
          addLog("Profile data received and processed.", "success")
          return
        }

        if (response.text === "LOADING") {
          setProfile({
            statusText: "Data transfer in progress... waiting for data...",
            data: null,
          })
          await sleep(PROFILE_POLL_DELAY_MS)
          continue
        }

        setProfile({
          statusText: `Error fetching profile data: ${response.text}`,
          data: response.data || null,
        })
        addLog(`Error fetching profile data from /FLOAT/listen: ${response.text}`, "error")
        return
      }

      setProfile({
        statusText: "Timeout waiting for data from backend.",
        data: null,
      })
      addLog("Timeout waiting for /FLOAT/listen to return FINISHED.", "error")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLastAck({ command: "LISTENING", status: "failed" })
      setProfile({
        statusText: "Network error fetching profile data.",
        data: null,
      })
      addLog(`Network error on profile fetch: ${message}`, "error")
    } finally {
      setBusyCommand(null)
    }
  }, [addLog])

  const commands = useMemo(
    () =>
      COMMANDS.map((command): CommandItem => ({
        ...command,
        busy: busyCommand === command.id,
        disabled: busyCommand !== null,
        ack: lastAck.command === command.id ? lastAck.status : "none",
        onClick: () => {
          void runCommand(command.id)
        },
      })),
    [busyCommand, lastAck, runCommand]
  )

  const statusItems = useMemo<StatusItem[]>(
    () =>
      Object.values(status).map((item) => ({
        label: item.label,
        value: item.value,
        status: item.status,
        helperText: item.helperText,
      })),
    [status]
  )

  const state = useMemo<FloatMissionState>(
    () => ({
      connections,
      statusItems,
      status,
      dataAvailable,
      lastAck,
      busyCommand,
      logs,
      packageData,
      profile,
      runtimeProfile,
      runtimeProfileStatus,
      runtimePidConfig,
      runtimePidConfigStatus,
      runtimeBalanceConfig,
      runtimeBalanceConfigStatus,
      runtimeMotorConfig,
      runtimeMotorConfigStatus,
    }),
    [
      busyCommand,
      connections,
      dataAvailable,
      lastAck,
      logs,
      packageData,
      profile,
      runtimeBalanceConfig,
      runtimeBalanceConfigStatus,
      runtimeMotorConfig,
      runtimeMotorConfigStatus,
      runtimePidConfig,
      runtimePidConfigStatus,
      runtimeProfile,
      runtimeProfileStatus,
      status,
      statusItems,
    ]
  )

  return {
    applyRuntimeBalanceConfig,
    applyRuntimeMotorConfig,
    applyRuntimePidConfig,
    applyRuntimeProfile,
    applySyringe,
    commands,
    fetchProfileData,
    refreshRuntimeBalanceConfig,
    refreshRuntimeMotorConfig,
    refreshRuntimePidConfig,
    refreshRuntimeProfile,
    isFetchingProfile: busyCommand === "FETCH_PROFILE",
    isBusy: busyCommand !== null,
    sendTestSteps,
    state,
  }
}
