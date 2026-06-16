import type { NexusControllerStatus, NexusInfo } from "@/types/eva"
import type { CoralAnalysisResult } from "@/types/coral"
import type { CrabAnalysisResult } from "@/types/crab"

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

/**
 * Send a captured camera frame to the coral-garden CV pipeline.
 *
 * A 422 is a valid, structured CV failure (e.g. ruler not found) — its JSON body
 * is returned so the UI can show a friendly message. Other non-2xx are thrown.
 */
export async function analyzeCoralGarden(
  image: Blob,
  signal?: AbortSignal
): Promise<CoralAnalysisResult> {
  const form = new FormData()
  form.append("image", image, "coral.jpg")

  const response = await fetch(`${getNexusBaseUrl()}/coral/analyze`, {
    method: "POST",
    body: form,
    signal,
  })

  if (!response.ok && response.status !== 422) {
    throw new Error(`NEXUS /coral/analyze failed with ${response.status}`)
  }

  return response.json() as Promise<CoralAnalysisResult>
}

/**
 * Send a captured camera frame to the invasive-crab counter (Task 2.1).
 *
 * A 422 carries a structured CV failure body; other non-2xx are thrown.
 */
export async function analyzeCrabSample(
  image: Blob,
  signal?: AbortSignal
): Promise<CrabAnalysisResult> {
  const form = new FormData()
  form.append("image", image, "crab.jpg")

  const response = await fetch(`${getNexusBaseUrl()}/crab/analyze`, {
    method: "POST",
    body: form,
    signal,
  })

  if (!response.ok && response.status !== 422) {
    throw new Error(`NEXUS /crab/analyze failed with ${response.status}`)
  }

  return response.json() as Promise<CrabAnalysisResult>
}
