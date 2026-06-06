import type {
  NexusFloatListenResponse,
  NexusFloatConfigResponse,
  NexusFloatProfileResponse,
  NexusFloatResponse,
  FloatRuntimeBalanceConfig,
  FloatRuntimeMotorConfig,
  FloatRuntimePidConfig,
  FloatRuntimeProfile,
} from "@/types/float"

export function getNexusBaseUrl() {
  return import.meta.env.VITE_NEXUS_BASE_URL?.replace(/\/$/, "") ?? ""
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${getNexusBaseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
    },
    signal,
  })

  const data = (await response.json()) as T

  if (!response.ok) {
    const text =
      typeof data === "object" &&
      data !== null &&
      "text" in data &&
      typeof data.text === "string"
        ? data.text
        : response.statusText
    throw new Error(`NEXUS ${path} failed with ${response.status}: ${text}`)
  }

  return data
}

async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${getNexusBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  })

  const data = (await response.json()) as T

  if (!response.ok) {
    const text =
      typeof data === "object" &&
      data !== null &&
      "text" in data &&
      typeof data.text === "string"
        ? data.text
        : response.statusText
    throw new Error(`NEXUS ${path} failed with ${response.status}: ${text}`)
  }

  return data
}

export function startFloat(signal?: AbortSignal) {
  return getJson<NexusFloatResponse>("/FLOAT/start", signal)
}

export function getFloatStatus(signal?: AbortSignal) {
  return getJson<NexusFloatResponse>("/FLOAT/status?msg=STATUS", signal)
}

export function sendFloatCommand(command: string, signal?: AbortSignal) {
  return getJson<NexusFloatResponse>(
    `/FLOAT/msg?msg=${encodeURIComponent(command)}`,
    signal
  )
}

export function listenFloatProfile(signal?: AbortSignal) {
  return getJson<NexusFloatListenResponse>("/FLOAT/listen", signal)
}

export function setFloatSyringe(uNorm: number, durationS: number, signal?: AbortSignal) {
  return sendFloatCommand(`SYRINGE_SET ${uNorm} ${durationS}`, signal)
}

export function getFloatProfile(signal?: AbortSignal) {
  return getJson<NexusFloatProfileResponse>("/FLOAT/profile", signal)
}

export function setFloatProfile(profile: FloatRuntimeProfile, signal?: AbortSignal) {
  return postJson<NexusFloatProfileResponse>("/FLOAT/profile", profile, signal)
}

export function getFloatPidConfig(signal?: AbortSignal) {
  return getJson<NexusFloatConfigResponse<FloatRuntimePidConfig>>(
    "/FLOAT/pid-config",
    signal
  )
}

export function setFloatPidConfig(config: FloatRuntimePidConfig, signal?: AbortSignal) {
  return postJson<NexusFloatConfigResponse<FloatRuntimePidConfig>>(
    "/FLOAT/pid-config",
    config,
    signal
  )
}

export function getFloatBalanceConfig(signal?: AbortSignal) {
  return getJson<NexusFloatConfigResponse<FloatRuntimeBalanceConfig>>(
    "/FLOAT/balance-config",
    signal
  )
}

export function setFloatBalanceConfig(config: FloatRuntimeBalanceConfig, signal?: AbortSignal) {
  return postJson<NexusFloatConfigResponse<FloatRuntimeBalanceConfig>>(
    "/FLOAT/balance-config",
    config,
    signal
  )
}

export function getFloatMotorConfig(signal?: AbortSignal) {
  return getJson<NexusFloatConfigResponse<FloatRuntimeMotorConfig>>(
    "/FLOAT/motor-config",
    signal
  )
}

export function setFloatMotorConfig(config: FloatRuntimeMotorConfig, signal?: AbortSignal) {
  return postJson<NexusFloatConfigResponse<FloatRuntimeMotorConfig>>(
    "/FLOAT/motor-config",
    config,
    signal
  )
}
