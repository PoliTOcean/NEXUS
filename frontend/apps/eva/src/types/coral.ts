/** Result of POST /coral/analyze — the Task 1.2 coral-garden CV pipeline. */
export type CoralAnalysisResult = {
  ok: boolean
  length_cm: number | null
  height_cm: number | null
  targets_count: number
  annotated_url: string | null
  captured_at: string
  error: string | null
}
