/** A single species frequency row in the /edna/frequency response. */
export type EdnaSpecies = {
  name: string
  count: number
  /** Full-precision percentage. */
  percent: number
  /** Percentage rounded to 2 decimals, for display to the judge. */
  percent_display: number
}

/** Result of POST /edna/frequency — the Task 2.5 eDNA frequency calculator. */
export type EdnaFrequencyResult = {
  ok: boolean
  total: number
  species: EdnaSpecies[]
  error?: string
}
