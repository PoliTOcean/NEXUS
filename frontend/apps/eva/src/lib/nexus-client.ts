import type { NexusControllerStatus, NexusInfo } from "@/types/eva"
import type { CoralAnalysisResult } from "@/types/coral"
import type { CrabAnalysisResult } from "@/types/crab"
import type { IcebergEvaluation, IcebergInput } from "@/types/iceberg"
import type { EdnaFrequencyResult } from "@/types/edna"

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
 * Reconstruct the coral garden from a FRONT + BACK photo pair (Task 1.2).
 *
 * The CV model needs both views to rebuild the structure and place the targets.
 * A 422 carries a structured CV failure body (e.g. ruler not found, or the
 * two-photo `reconstruct` not yet available on the backend); other non-2xx throw.
 */
export async function reconstructCoralGarden(
  front: Blob,
  back: Blob,
  signal?: AbortSignal
): Promise<CoralAnalysisResult> {
  const form = new FormData()
  form.append("front", front, "coral-front.jpg")
  form.append("back", back, "coral-back.jpg")

  const response = await fetch(`${getNexusBaseUrl()}/coral/reconstruct`, {
    method: "POST",
    body: form,
    signal,
  })

  if (!response.ok && response.status !== 422) {
    throw new Error(`NEXUS /coral/reconstruct failed with ${response.status}`)
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

/**
 * Evaluate the iceberg threat level for the 4 fixed oil platforms (Task 2.2).
 *
 * Pure calculation: posts the iceberg info sheet (lat/lon/heading/keel depth)
 * and returns the per-platform surface/subsea threat levels. A 400 means the
 * sheet was malformed; it's thrown rather than returned.
 */
export async function evaluateIceberg(
  iceberg: IcebergInput,
  signal?: AbortSignal
): Promise<IcebergEvaluation> {
  const response = await fetch(`${getNexusBaseUrl()}/iceberg/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iceberg }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`NEXUS /iceberg/evaluate failed with ${response.status}`)
  }

  return response.json() as Promise<IcebergEvaluation>
}

/**
 * Compute the eDNA species frequency (%) for the judge (Task 2.5).
 *
 * Pure arithmetic: posts the species counts and returns each species' share of
 * the total. A 422 carries a structured failure (e.g. empty / zero total); its
 * body is returned so the UI can show a friendly message. Other non-2xx throw.
 */
export async function calculateEdnaFrequency(
  counts: Record<string, number>,
  signal?: AbortSignal
): Promise<EdnaFrequencyResult> {
  const response = await fetch(`${getNexusBaseUrl()}/edna/frequency`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ counts }),
    signal,
  })

  if (!response.ok && response.status !== 422) {
    throw new Error(`NEXUS /edna/frequency failed with ${response.status}`)
  }

  return response.json() as Promise<EdnaFrequencyResult>
}
