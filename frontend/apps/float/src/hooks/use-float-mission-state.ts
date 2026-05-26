import { useCallback, useEffect, useMemo, useState } from "react"
import type { CommandItem, LogItem, StatusItem, UiStatus } from "@politocean/ui/types"

import {
  getFloatStatus,
  listenFloatProfile,
  sendFloatCommand,
  startFloat,
} from "@/lib/nexus-client"
import type {
  FloatConnectionState,
  FloatMissionState,
  FloatPackageState,
  FloatStatusKey,
  FloatStatusState,
  NexusFloatResponse,
} from "@/types/float"

const FLOAT_TARGET_DEPTH = 2.5
const FLOAT_MAX_ERROR = 0.33
const MAX_LOG_CHARS = 5000
const PROFILE_POLL_ATTEMPTS = 40
const PROFILE_POLL_DELAY_MS = 250

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
          return
        }

        addLog(`Failed to connect to float: ${response.text}`, "error")
        applyStatusText(response.text)
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : String(error)
        addLog(`Network error during initial float connection: ${message}`, "error")
        setConnections((currentConnections) =>
          updateConnection(currentConnections, "backend", "error", "Offline")
        )
        applyStatusText("NO USB")
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
  }, [addLog, applyStatusText, pollStatus])

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

  const sendPidParams = useCallback(
    (kp: string, ki: string, kd: string) => {
      if (!kp || !ki || !kd) {
        addLog("PID command skipped: Kp, Ki, and Kd are required.", "warning")
        return
      }

      void runCommand(`PARAMS ${kp} ${ki} ${kd}`)
    },
    [addLog, runCommand]
  )

  const sendTestFrequency = useCallback(
    (frequency: string) => {
      if (!frequency) {
        addLog("Test frequency command skipped: value is required.", "warning")
        return
      }

      void runCommand(`TEST_FREQ ${frequency}`)
    },
    [addLog, runCommand]
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
    }),
    [
      busyCommand,
      connections,
      dataAvailable,
      lastAck,
      logs,
      packageData,
      profile,
      status,
      statusItems,
    ]
  )

  return {
    commands,
    fetchProfileData,
    isFetchingProfile: busyCommand === "FETCH_PROFILE",
    isBusy: busyCommand !== null,
    sendPidParams,
    sendTestFrequency,
    sendTestSteps,
    state,
  }
}
