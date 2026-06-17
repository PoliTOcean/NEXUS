/** A green/yellow/red threat level returned by the Task 2.2 iceberg calculator. */
export type ThreatLevel = "green" | "yellow" | "red"

/** Iceberg info sheet sent to POST /iceberg/evaluate. */
export type IcebergInput = {
  lat: number
  lon: number
  heading_deg: number
  keel_depth_m: number
  /** Optional: use the forward half-line CPA instead of the infinite line. */
  forward_only?: boolean
}

/** Per-platform threat row in the /iceberg/evaluate response. */
export type IcebergPlatformThreat = {
  name: string
  passing_distance_nm: number
  water_depth_m: number
  keel_ratio: number
  surface_threat: ThreatLevel
  subsea_threat: ThreatLevel
}

/** Result of POST /iceberg/evaluate — the Task 2.2 iceberg threat-level calc. */
export type IcebergEvaluation = {
  ok: boolean
  platforms: IcebergPlatformThreat[]
  iceberg?: IcebergInput
  error?: string
}
