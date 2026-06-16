/** Result of POST /crab/analyze — the Task 2.1 invasive-crab counter. */
export type CrabAnalysisResult = {
  ok: boolean
  green_count: number
  total_detections: number
  annotated_url: string | null
  captured_at: string
  error: string | null
}
