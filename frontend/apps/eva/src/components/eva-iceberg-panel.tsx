import { useCallback, useRef, useState } from "react"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@politocean/ui"
import { cn } from "@politocean/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { IceCubesIcon } from "@hugeicons/core-free-icons"

import { evaluateIceberg } from "@/lib/nexus-client"
import type {
  IcebergEvaluation,
  IcebergInput,
  ThreatLevel,
} from "@/types/iceberg"

type Status = "idle" | "evaluating" | "done" | "error"

/** Form fields kept as strings so the inputs can be cleared/edited freely. */
type FormState = {
  lat: string
  lon: string
  heading_deg: string
  keel_depth_m: string
}

const INITIAL_FORM: FormState = {
  lat: "",
  lon: "",
  heading_deg: "",
  keel_depth_m: "",
}

const THREAT_CELL: Record<ThreatLevel, string> = {
  green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  yellow: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  red: "bg-red-500/25 text-red-300 border-red-500/50",
}

const THREAT_LABEL: Record<ThreatLevel, string> = {
  green: "VERDE",
  yellow: "GIALLO",
  red: "ROSSO",
}

function ThreatBadge({ level }: { level: ThreatLevel }) {
  return (
    <span
      className={cn(
        "inline-flex w-full items-center justify-center rounded border px-2 py-1 text-xs font-semibold tracking-wide",
        THREAT_CELL[level]
      )}
    >
      {THREAT_LABEL[level]}
    </span>
  )
}

export function EvaIcebergPanel() {
  const [status, setStatus] = useState<Status>("idle")
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [result, setResult] = useState<IcebergEvaluation | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const busy = status === "evaluating"

  const setField = useCallback(
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }))
    },
    []
  )

  const parsed = ((): IcebergInput | null => {
    const lat = Number(form.lat)
    const lon = Number(form.lon)
    const heading_deg = Number(form.heading_deg)
    const keel_depth_m = Number(form.keel_depth_m)
    const allFilled = Object.values(form).every((v) => v.trim() !== "")
    const allFinite = [lat, lon, heading_deg, keel_depth_m].every(Number.isFinite)
    if (!allFilled || !allFinite) return null
    return { lat, lon, heading_deg, keel_depth_m }
  })()

  const runEvaluate = useCallback(async () => {
    if (!parsed) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setErrorMessage("")
    setStatus("evaluating")

    try {
      const evaluation = await evaluateIceberg(parsed, controller.signal)
      setResult(evaluation)
      setStatus(evaluation.ok ? "done" : "error")
      if (!evaluation.ok) {
        setErrorMessage("Valutazione non riuscita.")
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Errore durante la valutazione."
      )
    }
  }, [parsed])

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      void runEvaluate()
    },
    [runEvaluate]
  )

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setDialogOpen(true)}
        title="Calcola il livello di minaccia dell'iceberg per le 4 piattaforme"
      >
        <HugeiconsIcon icon={IceCubesIcon} strokeWidth={2} data-icon="inline-start" />
        Iceberg
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Iceberg Threat Level — Task 2.2</DialogTitle>
            <DialogDescription>
              Inserisci l'iceberg info sheet (lat/lon, heading bussola, keel
              depth). Coordinate piattaforme fisse da regolamento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ice-lat">Latitudine (°)</Label>
              <Input
                id="ice-lat"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="46.4"
                value={form.lat}
                onChange={setField("lat")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ice-lon">Longitudine (°)</Label>
              <Input
                id="ice-lon"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="-48.5"
                value={form.lon}
                onChange={setField("lon")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ice-heading">Heading (°)</Label>
              <Input
                id="ice-heading"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="90"
                value={form.heading_deg}
                onChange={setField("heading_deg")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ice-keel">Keel depth (m)</Label>
              <Input
                id="ice-keel"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="95"
                value={form.keel_depth_m}
                onChange={setField("keel_depth_m")}
              />
            </div>
            {/* Hidden submit so Enter triggers evaluation. */}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>

          {status === "done" && result?.platforms && (
            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr_1fr] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Piattaforma</span>
                <span className="text-right">CPA (NM)</span>
                <span className="text-right">Keel ratio</span>
                <span className="text-center">Superficie</span>
                <span className="text-center">Subsea</span>
              </div>
              {result.platforms.map((p) => (
                <div
                  key={p.name}
                  className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr_1fr] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-right font-mono tabular-nums">
                    {p.passing_distance_nm.toFixed(2)}
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    {p.keel_ratio.toFixed(3)}
                  </span>
                  <ThreatBadge level={p.surface_threat} />
                  <ThreatBadge level={p.subsea_threat} />
                </div>
              ))}
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <DialogFooter showCloseButton>
            <Button
              type="button"
              variant="default"
              disabled={!parsed || busy}
              onClick={runEvaluate}
              title={parsed ? undefined : "Compila tutti i campi con valori numerici"}
            >
              {busy ? "Calcolo..." : "Valuta minaccia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
