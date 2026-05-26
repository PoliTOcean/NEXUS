import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import mqtt, { type MqttClient } from "mqtt"
import Janus from "janus-gateway"
import type { UiStatus } from "@politocean/ui"

import {
  getNexusControllerStatus,
  getNexusInfo,
} from "@/lib/nexus-client"
import type {
  EvaCamera,
  EvaFisheyeSettings,
  EvaConnectionId,
  EvaConnectionState,
  EvaJoystickCommandStatus,
  EvaJoystickStatus,
  EvaJoystickStatusValue,
  EvaMissionState,
  EvaTelemetry,
  NexusCameraInfo,
  NexusInfo,
  NexusStatusPayload,
} from "@/types/eva"

type JanusStreamInfo = {
  id: number | string
  description?: string
  metadata?: string
}

type JanusPluginHandle = {
  send: (options: {
    message: Record<string, unknown>
    jsep?: unknown
    success?: (result: { list?: JanusStreamInfo[] }) => void
    error?: (error: unknown) => void
  }) => void
  createAnswer: (options: {
    jsep: unknown
    media: Record<string, boolean>
    success: (jsep: unknown) => void
    error: (error: unknown) => void
  }) => void
}

type JanusSession = {
  attach: (options: {
    plugin: string
    success: (pluginHandle: JanusPluginHandle) => void
    error: (error: unknown) => void
    onmessage?: (message: Record<string, unknown>, jsep?: unknown) => void
    onremotetrack?: (track: MediaStreamTrack, mid: string, on: boolean) => void
    oncleanup?: () => void
  }) => void
  destroy: () => void
}

type JanusConstructor = {
  init: (options: { debug: string | false; callback: () => void }) => void
  new (options: {
    server: string
    iceServers: RTCIceServer[]
    success: () => void
    error: (error: unknown) => void
    destroyed: () => void
  }): JanusSession
}

const JanusClient = Janus as unknown as JanusConstructor

const INITIAL_TELEMETRY: EvaTelemetry = {
  heading: null,
  roll: null,
  pitch: null,
  pitchReference: null,
  absoluteAltitude: null,
  relativeAltitude: null,
  missionElapsedMs: 0,
}

const INITIAL_CONNECTIONS: EvaConnectionState[] = [
  { id: "backend", label: "Backend", status: "loading", detail: "Connecting" },
  { id: "mqtt", label: "MQTT", status: "offline", detail: "Waiting" },
  { id: "janus", label: "Janus", status: "offline", detail: "Waiting" },
  {
    id: "controller",
    label: "Controller",
    status: "offline",
    detail: "Waiting",
  },
]

const INITIAL_JOYSTICK_STATUS: EvaJoystickStatus = {
  id: "JOYSTICK",
  label: "JOYSTICK",
  value: "OFF",
  status: "offline",
}

const JOYSTICK_COMMAND_STATUS_IDS: EvaJoystickCommandStatus["id"][] = [
  "WORK",
  "ARMED",
  "TORQUE",
  "DEPTH",
  "ROLL",
  "PITCH",
]

const INITIAL_JOYSTICK_COMMAND_STATUSES: EvaJoystickCommandStatus[] =
  JOYSTICK_COMMAND_STATUS_IDS.map((id) => ({
    id,
    label: id,
    value: "OFF",
    status: "offline",
  }))

function toNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeStatusValue(
  value: EvaJoystickStatusValue | boolean | number | undefined
): EvaJoystickStatusValue {
  if (value === true || value === 1) return "OK"
  if (value === false || value === 0 || value === undefined) return "OFF"
  if (
    value === "OK" ||
    value === "OFF" ||
    value === "READY" ||
    value === "ACTIVE"
  ) {
    return value
  }
  return "OFF"
}

function resolveModeStatus(value: EvaJoystickStatusValue): UiStatus {
  if (value === "OK" || value === "ACTIVE") return "success"
  if (value === "READY") return "error"
  return "offline"
}

function createJoystickStatus(
  value: EvaJoystickStatusValue | boolean | number | undefined
) {
  const nextValue = normalizeStatusValue(value)

  return {
    ...INITIAL_JOYSTICK_STATUS,
    value: nextValue,
    status: resolveModeStatus(nextValue),
  }
}

function updateJoystickCommandValue(
  statuses: EvaJoystickCommandStatus[],
  id: EvaJoystickCommandStatus["id"],
  value: EvaJoystickStatusValue | boolean | number | undefined
) {
  const nextValue = normalizeStatusValue(value)

  return statuses.map((item) =>
    item.id === id
      ? {
          ...item,
          value: nextValue,
          status: resolveModeStatus(nextValue),
        }
      : item
  )
}

function getFirstEnabledCameraId(cameras: EvaCamera[], fallback: string) {
  return cameras.find((camera) => camera.enabled)?.id ?? fallback
}

type EvaStreamMetadata = {
  aspectRatio?: EvaCamera["aspectRatio"]
  fisheye?: boolean
  fisheyeSettings?: Partial<Omit<EvaFisheyeSettings, "enabled">>
}

function normalizeFisheyeSettings(
  metadata: EvaStreamMetadata | null
): EvaFisheyeSettings | null {
  if (!metadata?.fisheye) return null

  return {
    enabled: true,
    lens:
      typeof metadata.fisheyeSettings?.lens === "number"
        ? metadata.fisheyeSettings.lens
        : 1,
    fov:
      typeof metadata.fisheyeSettings?.fov === "number"
        ? metadata.fisheyeSettings.fov
        : 1,
  }
}

function parseStreamMetadata(metadata: string | undefined) {
  if (!metadata) return null

  try {
    return JSON.parse(metadata) as EvaStreamMetadata
  } catch {
    return null
  }
}

function createCameraFromStream(stream: JanusStreamInfo): EvaCamera {
  const id = String(stream.id)
  const metadata = parseStreamMetadata(stream.metadata)

  return {
    id,
    name: `Camera ${id}`,
    description: stream.description ?? `Stream ${id}`,
    aspectRatio: metadata?.aspectRatio ?? "16/9",
    fisheye: normalizeFisheyeSettings(metadata),
    enabled: true,
    status: "loading",
    resolution: "",
    fps: null,
    latencyMs: null,
    stream: null,
  }
}

const DEFAULT_DEBUG_CAMERAS: NexusCameraInfo[] = [
  {
    id: 1,
    name: "Front",
    description: "Debug front camera",
    aspectRatio: "16/9",
  },
  {
    id: 2,
    name: "Bottom",
    description: "Debug bottom camera",
    aspectRatio: "4/3",
  },
  {
    id: 3,
    name: "Manipulator",
    description: "Debug manipulator camera",
    aspectRatio: "16/9",
  },
  {
    id: 4,
    name: "Rear",
    description: "Debug rear camera",
    aspectRatio: "16/9",
  },
]

function getDebugCameraList(info: NexusInfo) {
  const cameraList = info.cameras ?? info.janus?.cameras ?? info.janus?.streams

  if (cameraList?.length) return cameraList
  if (info.mode === "debug") return DEFAULT_DEBUG_CAMERAS

  return []
}

function normalizeDebugCamera(
  camera: NexusCameraInfo,
  index: number
): EvaCamera {
  if (typeof camera === "string" || typeof camera === "number") {
    const id = String(camera)

    return {
      id,
      name: `Camera ${id}`,
      description: `Debug stream ${index + 1}`,
      aspectRatio: "16/9",
      fisheye: null,
      enabled: true,
      status: "online",
      resolution: "1280 x 720",
      fps: 30,
      latencyMs: null,
      stream: null,
    }
  }

  const id = String(camera.id ?? index + 1)

  return {
    id,
    name: camera.name ?? `Camera ${id}`,
    description: camera.description ?? `Debug stream ${index + 1}`,
    aspectRatio: camera.aspectRatio ?? "16/9",
    fisheye: null,
    enabled: camera.enabled ?? true,
    status: camera.status ?? "online",
    resolution: camera.resolution ?? "1280 x 720",
    fps: camera.fps ?? 30,
    latencyMs: camera.latencyMs ?? null,
    stream: null,
  }
}

function createDebugCameraStream(label: string, aspectRatio: EvaCamera["aspectRatio"]) {
  const canvas = document.createElement("canvas")
  canvas.width = aspectRatio === "4/3" ? 1024 : aspectRatio === "21/9" ? 1680 : 1280
  canvas.height = aspectRatio === "4/3" ? 768 : 720

  const context = canvas.getContext("2d")
  if (!context || !canvas.captureStream) return null

  let animationFrameId = 0

  function draw() {
    if (!context) return

    const elapsedSeconds = performance.now() / 1000
    const width = canvas.width
    const height = canvas.height
    const hue = (elapsedSeconds * 24) % 360

    context.fillStyle = `hsl(${hue}, 46%, 12%)`
    context.fillRect(0, 0, width, height)

    context.fillStyle = "rgba(255, 255, 255, 0.08)"
    for (let x = 0; x < width; x += 80) {
      context.fillRect(x, 0, 2, height)
    }
    for (let y = 0; y < height; y += 80) {
      context.fillRect(0, y, width, 2)
    }

    context.fillStyle = "white"
    context.font = "700 48px Figtree, system-ui, sans-serif"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(label, width / 2, height / 2 - 18)

    context.font = "500 24px Figtree, system-ui, sans-serif"
    context.fillStyle = "rgba(255, 255, 255, 0.72)"
    context.fillText(new Date().toLocaleTimeString(), width / 2, height / 2 + 34)

    animationFrameId = window.requestAnimationFrame(draw)
  }

  draw()

  const stream = canvas.captureStream(30)

  return {
    stream,
    stop() {
      window.cancelAnimationFrame(animationFrameId)
      stream.getTracks().forEach((track) => track.stop())
    },
  }
}

export function useEvaMissionState() {
  const [cameras, setCameras] = useState<EvaCamera[]>([])
  const [connections, setConnections] =
    useState<EvaConnectionState[]>(INITIAL_CONNECTIONS)
  const [primaryCameraId, setPrimaryCameraId] = useState("")
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [telemetry, setTelemetry] =
    useState<EvaTelemetry>(INITIAL_TELEMETRY)
  const [joystickStatus, setJoystickStatus] = useState<EvaJoystickStatus>(
    INITIAL_JOYSTICK_STATUS
  )
  const [joystickCommandStatuses, setJoystickCommandStatuses] = useState<
    EvaJoystickCommandStatus[]
  >(INITIAL_JOYSTICK_COMMAND_STATUSES)
  const camerasRef = useRef<EvaCamera[]>([])
  const primaryCameraIdRef = useRef("")

  const setConnection = useCallback(
    (id: EvaConnectionId, status: EvaConnectionState["status"], detail: string) => {
      setConnections((currentConnections) =>
        currentConnections.map((connection) =>
          connection.id === id ? { ...connection, status, detail } : connection
        )
      )
    },
    []
  )

  const selectCamera = useCallback(
    (cameraId: string) => {
      const camera = cameras.find((item) => item.id === cameraId)
      if (!camera?.enabled) return
      primaryCameraIdRef.current = cameraId
      setPrimaryCameraId(cameraId)
    },
    [cameras]
  )

  const switchCameraByOffset = useCallback((offset: 1 | -1) => {
    const enabledCameras = camerasRef.current.filter((camera) => camera.enabled)
    if (enabledCameras.length === 0) return

    const currentIndex = Math.max(
      0,
      enabledCameras.findIndex(
        (camera) => camera.id === primaryCameraIdRef.current
      )
    )
    const nextIndex =
      (currentIndex + offset + enabledCameras.length) % enabledCameras.length
    const nextPrimaryId =
      enabledCameras[nextIndex]?.id ?? primaryCameraIdRef.current

    primaryCameraIdRef.current = nextPrimaryId
    setPrimaryCameraId(nextPrimaryId)
  }, [])

  const setCameraEnabled = useCallback((cameraId: string, enabled: boolean) => {
    setCameras((currentCameras) => {
      const nextCameras = currentCameras.map((camera) =>
        camera.id === cameraId ? { ...camera, enabled } : camera
      )
      camerasRef.current = nextCameras

      setPrimaryCameraId((currentPrimaryId) => {
        if (cameraId !== currentPrimaryId || enabled) return currentPrimaryId
        const nextPrimaryId = getFirstEnabledCameraId(
          nextCameras,
          currentPrimaryId
        )
        primaryCameraIdRef.current = nextPrimaryId
        return nextPrimaryId
      })

      return nextCameras
    })
  }, [])

  const resetRelativeAltitude = useCallback(() => {
    setTelemetry((currentTelemetry) => ({
      ...currentTelemetry,
      relativeAltitude: 0,
    }))
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    camerasRef.current = cameras
  }, [cameras])

  useEffect(() => {
    primaryCameraIdRef.current = primaryCameraId
  }, [primaryCameraId])

  useEffect(() => {
    const abortController = new AbortController()
    let disposed = false
    let controllerIntervalId: number | undefined
    let mqttClient: MqttClient | undefined
    let janusSession: JanusSession | undefined
    let latestInfo: NexusInfo | undefined
    let backendOnline = false
    let debugCameraCleanups: Array<() => void> = []

    function applyStatusPayload(payload: NexusStatusPayload) {
      setTelemetry((currentTelemetry) => ({
        ...currentTelemetry,
        heading: toNumber(payload.yaw),
        roll: toNumber(payload.roll),
        pitch: toNumber(payload.pitch),
        pitchReference: toNumber(payload.reference_pitch),
        absoluteAltitude: toNumber(payload.depth),
        relativeAltitude: toNumber(payload.reference_z),
      }))

      setJoystickCommandStatuses((currentStatuses) => {
        let nextStatuses = currentStatuses
        nextStatuses = updateJoystickCommandValue(
          nextStatuses,
          "ARMED",
          payload.rov_armed
        )
        nextStatuses = updateJoystickCommandValue(
          nextStatuses,
          "WORK",
          payload.work_mode
        )
        nextStatuses = updateJoystickCommandValue(
          nextStatuses,
          "TORQUE",
          payload.torque_mode
        )
        nextStatuses = updateJoystickCommandValue(
          nextStatuses,
          "DEPTH",
          payload.controller_state?.DEPTH
        )
        nextStatuses = updateJoystickCommandValue(
          nextStatuses,
          "ROLL",
          payload.controller_state?.ROLL
        )
        nextStatuses = updateJoystickCommandValue(
          nextStatuses,
          "PITCH",
          payload.controller_state?.PITCH
        )
        return nextStatuses
      })
    }

    async function pollController() {
      try {
        const controllerStatus = await getNexusControllerStatus(
          abortController.signal
        )
        if (disposed) return

        const wasBackendOnline = backendOnline
        backendOnline = true
        if (latestInfo) setConnection("backend", "success", latestInfo.mode)
        if (!wasBackendOnline && latestInfo) {
          startRealtimeConnections(latestInfo)
        }

        const isConnected = Boolean(controllerStatus.status)
        const isRunning = Boolean(controllerStatus.isRunning)
        setConnection(
          "controller",
          isRunning && isConnected
            ? "success"
            : isRunning
              ? "warning"
              : isConnected
                ? "warning"
                : "offline",
          isRunning && isConnected
            ? "Running"
            : isRunning
              ? "Running, joystick offline"
              : isConnected
                ? "Connected"
                : "Offline"
        )
        setJoystickStatus(createJoystickStatus(isConnected))
      } catch {
        if (disposed || abortController.signal.aborted) return

        try {
          latestInfo = await getNexusInfo(abortController.signal)
          if (disposed) return

          const wasBackendOnline = backendOnline
          backendOnline = true
          setConnection("backend", "success", latestInfo.mode)
          setConnection("controller", "offline", "Unavailable")
          if (!wasBackendOnline) startRealtimeConnections(latestInfo)
        } catch {
          if (disposed || abortController.signal.aborted) return

          backendOnline = false
          setConnection("backend", "offline", "Unavailable")
          setConnection("controller", "offline", "Waiting for backend")
          stopRealtimeConnections("Waiting for backend")
        }

        setJoystickStatus(createJoystickStatus(false))
      }
    }

    function startControllerPolling() {
      void pollController()
      controllerIntervalId = window.setInterval(() => {
        void pollController()
      }, 2000)
    }

    function startMqtt(info: NexusInfo) {
      const mqttUrl = info.mqtt?.ip
      if (!mqttUrl) {
        setConnection("mqtt", "offline", "No endpoint")
        return
      }

      mqttClient?.end(true)
      setConnection("mqtt", "loading", "Connecting")
      mqttClient = mqtt.connect(mqttUrl, {
        reconnectPeriod: 2000,
      })

      mqttClient.on("connect", () => {
        if (disposed) return
        setConnection("mqtt", "success", "Connected")
        mqttClient?.subscribe("status/")
        mqttClient?.subscribe("camera_control/")
      })

      mqttClient.on("reconnect", () => {
        if (!disposed && backendOnline) {
          setConnection("mqtt", "loading", "Reconnecting")
        }
      })

      mqttClient.on("close", () => {
        if (!disposed && backendOnline) {
          setConnection("mqtt", "offline", "Disconnected")
        }
      })

      mqttClient.on("error", () => {
        if (!disposed && backendOnline) {
          setConnection("mqtt", "error", "Connection error")
        }
      })

      mqttClient.on("message", (topic, message) => {
        if (disposed) return

        const text = message.toString()
        if (topic === "camera_control/") {
          if (text.includes("NEXT_CAMERA")) switchCameraByOffset(1)
          if (text.includes("PREV_CAMERA")) switchCameraByOffset(-1)
          return
        }

        if (topic !== "status/") return

        try {
          applyStatusPayload(JSON.parse(text) as NexusStatusPayload)
        } catch {
          setConnection("mqtt", "warning", "Invalid status payload")
        }
      })
    }

    function watchJanusStream(streamId: string, session: JanusSession) {
      let streamHandle: JanusPluginHandle | undefined

      session.attach({
        plugin: "janus.plugin.streaming",
        success(pluginHandle) {
          streamHandle = pluginHandle
          pluginHandle.send({
            message: { request: "watch", id: Number(streamId) || streamId },
          })
        },
        error() {
          setCameras((currentCameras) =>
            currentCameras.map((camera) =>
              camera.id === streamId ? { ...camera, status: "error" } : camera
            )
          )
        },
        onmessage(message, jsep) {
          if (!jsep) return

          const media = {
            audioSend: false,
            videoSend: false,
            audioRecv: message.type === "rtp",
            videoRecv: true,
          }

          streamHandle?.createAnswer({
            jsep,
            media,
            success(answerJsep) {
              streamHandle?.send({
                message: { request: "start" },
                jsep: answerJsep,
              })
            },
            error() {
              setCameras((currentCameras) =>
                currentCameras.map((camera) =>
                  camera.id === streamId
                    ? { ...camera, status: "error" }
                    : camera
                )
              )
            },
          })
        },
        onremotetrack(track, _mid, on) {
          if (!on || disposed) return

          setCameras((currentCameras) =>
            currentCameras.map((camera) =>
              camera.id === streamId
                ? {
                    ...camera,
                    status: "online",
                    stream: new MediaStream([track]),
                  }
                : camera
            )
          )
        },
      })
    }

    function startJanus(info: NexusInfo) {
      const debugCameraList = getDebugCameraList(info)
      if (debugCameraList.length > 0) {
        debugCameraCleanups.forEach((cleanup) => cleanup())
        debugCameraCleanups = []

        const nextCameras = debugCameraList.map((camera, index) => {
          const nextCamera = normalizeDebugCamera(camera, index)
          const debugStream = createDebugCameraStream(
            nextCamera.name,
            nextCamera.aspectRatio
          )

          if (debugStream) {
            debugCameraCleanups.push(debugStream.stop)
            return { ...nextCamera, stream: debugStream.stream }
          }

          return nextCamera
        })

        camerasRef.current = nextCameras
        setCameras(nextCameras)
        primaryCameraIdRef.current = nextCameras[0]?.id ?? ""
        setPrimaryCameraId(primaryCameraIdRef.current)
        setConnection("janus", "success", `Debug cameras: ${nextCameras.length}`)
        return
      }

      const janusUrl = info.janus?.ip
      if (!janusUrl) {
        setConnection("janus", "offline", "No endpoint")
        return
      }

      janusSession?.destroy()
      setConnection("janus", "loading", "Connecting")

      JanusClient.init({
        debug: false,
        callback() {
          if (disposed) return

          janusSession = new JanusClient({
            server: janusUrl,
            iceServers: [],
            success() {
              if (disposed || !janusSession) return

              janusSession.attach({
                plugin: "janus.plugin.streaming",
                success(pluginHandle) {
                  pluginHandle.send({
                    message: { request: "list" },
                    success(result) {
                      if (disposed) return

                      const streams = result.list ?? []
                      const nextCameras = streams.map(createCameraFromStream)
                      camerasRef.current = nextCameras
                      setCameras(nextCameras)
                      primaryCameraIdRef.current = nextCameras[0]?.id ?? ""
                      setPrimaryCameraId(primaryCameraIdRef.current)
                      setConnection(
                        "janus",
                        nextCameras.length > 0 ? "success" : "warning",
                        nextCameras.length > 0 ? "Connected" : "No streams"
                      )

                      streams.forEach((stream) => {
                        if (!janusSession) return
                        watchJanusStream(String(stream.id), janusSession)
                      })
                    },
                    error() {
                      if (!disposed) setConnection("janus", "error", "List failed")
                    },
                  })
                },
                error() {
                  if (!disposed) setConnection("janus", "error", "Attach failed")
                },
              })
            },
            error() {
              if (!disposed && backendOnline) {
                setConnection("janus", "offline", "Unavailable")
              }
            },
            destroyed() {
              if (!disposed && backendOnline) {
                setConnection("janus", "offline", "Destroyed")
              }
            },
          })
        },
      })
    }

    function stopRealtimeConnections(detail: string) {
      if (mqttClient) {
        const client = mqttClient
        mqttClient = undefined
        client.end(true)
      }

      if (janusSession) {
        const session = janusSession
        janusSession = undefined
        session.destroy()
      }

      debugCameraCleanups.forEach((cleanup) => cleanup())
      debugCameraCleanups = []

      setConnection("mqtt", "offline", detail)
      setConnection("janus", "offline", detail)
      camerasRef.current = []
      primaryCameraIdRef.current = ""
      setCameras([])
      setPrimaryCameraId("")
    }

    function startRealtimeConnections(info: NexusInfo) {
      try {
        startMqtt(info)
      } catch {
        if (!disposed) setConnection("mqtt", "error", "Startup error")
      }

      try {
        startJanus(info)
      } catch {
        if (!disposed) setConnection("janus", "error", "Startup error")
      }
    }

    async function start() {
      let info: NexusInfo

      try {
        setConnection("backend", "loading", "Connecting")
        info = await getNexusInfo(abortController.signal)
        if (disposed) return

        latestInfo = info
        backendOnline = true
        setConnection("backend", "success", info.mode)
      } catch {
        if (disposed || abortController.signal.aborted) return
        backendOnline = false
        setConnection("backend", "offline", "Unavailable")
        setConnection("controller", "offline", "Waiting for backend")
        stopRealtimeConnections("Waiting for backend")
        return
      }

      startControllerPolling()
      startRealtimeConnections(info)
    }

    void start()

    return () => {
      disposed = true
      abortController.abort()

      if (controllerIntervalId) window.clearInterval(controllerIntervalId)
      mqttClient?.end(true)
      janusSession?.destroy()
      debugCameraCleanups.forEach((cleanup) => cleanup())
    }
  }, [setConnection, switchCameraByOffset])

  const state = useMemo<EvaMissionState>(
    () => ({
      cameras,
      connections,
      primaryCameraId,
      telemetry: {
        ...telemetry,
        missionElapsedMs: now - startedAt,
      },
      joystickStatus,
      joystickCommandStatuses,
    }),
    [
      cameras,
      connections,
      joystickCommandStatuses,
      joystickStatus,
      now,
      primaryCameraId,
      startedAt,
      telemetry,
    ]
  )

  return {
    state,
    selectCamera,
    setCameraEnabled,
    resetRelativeAltitude,
  }
}
