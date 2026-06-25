/**
 * Result of the Task 1.2 coral-garden CV pipeline.
 * Shared by POST /coral/analyze and POST /coral/reconstruct; the latter also
 * returns `obj_url` (the generated .obj mesh of the reconstructed structure).
 */
export type CoralAnalysisResult = {
  ok: boolean
  length_cm: number | null
  height_cm: number | null
  targets_count: number
  annotated_url: string | null
  /** .obj mesh, only from /coral/reconstruct. */
  obj_url?: string | null
  captured_at: string
  error: string | null
}
