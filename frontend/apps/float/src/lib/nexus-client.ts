import type {
  NexusFloatListenResponse,
  NexusFloatResponse,
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
