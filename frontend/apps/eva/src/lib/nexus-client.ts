import type { NexusControllerStatus, NexusInfo } from "@/types/eva"

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

  if (!response.ok) {
    throw new Error(`NEXUS ${path} failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getNexusInfo(signal?: AbortSignal) {
  return getJson<NexusInfo>("/info", signal)
}

export function getNexusControllerStatus(signal?: AbortSignal) {
  return getJson<NexusControllerStatus>("/CONTROLLER/start_status", signal)
}
