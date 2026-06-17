import { useCallback, useMemo, useRef, useState } from "react"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@politocean/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { DnaIcon } from "@hugeicons/core-free-icons"

import { calculateEdnaFrequency } from "@/lib/nexus-client"
import type { EdnaFrequencyResult } from "@/types/edna"

type Status = "idle" | "calculating" | "done" | "error"

/** The 10 manual species from the manual, in fixed order. Counts start empty. */
const DEFAULT_SPECIES = [
  "Snow crab",
  "Acadian hermit crab",
  "Western Atlantic Hairy Hermit Crab",
  "European Green Crab",
  "Rock Crab",
  "Jonah Crab",
  "Spiny Sunstar",
  "Sea Urchin",
  "Boreal Sea Star",
  "Daisy brittle star",
]

type Row = { name: string; count: string }

const INITIAL_ROWS: Row[] = DEFAULT_SPECIES.map((name) => ({ name, count: "" }))

const ERROR_MESSAGES: Record<string, string> = {
  empty_or_zero_total:
    "Il totale dei conteggi è zero: inserisci almeno una specie con conteggio > 0.",
  bad_input: "Conteggi non validi.",
}

export function EvaEdnaPanel() {
  const [status, setStatus] = useState<Status>("idle")
  const [rows, setRows] = useState<Row[]>(INITIAL_ROWS)
  const [result, setResult] = useState<EdnaFrequencyResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const busy = status === "calculating"

  const localTotal = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0),
    [rows]
  )

  const setCount = useCallback(
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, count: value } : r))
      )
    },
    []
  )

  /** Map species name -> displayed percent, for the result column. */
  const percentByName = useMemo(() => {
    const map = new Map<string, number>()
    if (status === "done" && result?.species) {
      for (const s of result.species) map.set(s.name, s.percent_display)
    }
    return map
  }, [status, result])

  const runCalculate = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Build the counts payload; skip blank rows (treated as 0).
    const counts: Record<string, number> = {}
    for (const r of rows) {
      const n = Number(r.count)
      counts[r.name] = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
    }

    setErrorMessage("")
    setStatus("calculating")

    try {
      const freq = await calculateEdnaFrequency(counts, controller.signal)
      setResult(freq)
      if (freq.ok) {
        setStatus("done")
      } else {
        setStatus("error")
        setErrorMessage(
          (freq.error && ERROR_MESSAGES[freq.error]) || "Calcolo non riuscito."
        )
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Errore durante il calcolo."
      )
    }
  }, [rows])

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setDialogOpen(true)}
        title="Calcola la % di frequenza eDNA per ciascuna delle 10 specie"
      >
        <HugeiconsIcon icon={DnaIcon} strokeWidth={2} data-icon="inline-start" />
        eDNA
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>eDNA Frequency — Task 2.5</DialogTitle>
            <DialogDescription>
              Inserisci i conteggi delle 10 specie forniti dal giudice. La %
              vista = conteggio / totale × 100.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Specie</span>
              <span className="text-right">Conteggio</span>
              <span className="text-right">%</span>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {rows.map((row, index) => {
                const pct = percentByName.get(row.name)
                return (
                  <div
                    key={row.name}
                    className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-b px-3 py-1.5 text-sm last:border-b-0"
                  >
                    <span className="truncate" title={row.name}>
                      {row.name}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.count}
                      onChange={setCount(index)}
                      className="h-8 text-right font-mono tabular-nums"
                    />
                    <span className="text-right font-mono tabular-nums text-muted-foreground">
                      {pct !== undefined ? `${pct.toFixed(2)}%` : "—"}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-t bg-muted/40 px-3 py-2 text-sm font-semibold">
              <span>TOTALE</span>
              <span className="text-right font-mono tabular-nums">
                {status === "done" && result ? result.total : localTotal}
              </span>
              <span className="text-right font-mono tabular-nums">
                {status === "done" ? "100.00%" : "—"}
              </span>
            </div>
          </div>

          {status === "error" && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <DialogFooter showCloseButton>
            <Button
              type="button"
              variant="default"
              disabled={busy}
              onClick={runCalculate}
            >
              {busy ? "Calcolo..." : "Calcola"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
