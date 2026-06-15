import { useCallback, useRef, useState } from "react"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MetricCard,
} from "@politocean/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Camera01Icon } from "@hugeicons/core-free-icons"

import { captureFrameFromStream } from "@/lib/capture-frame"
import { analyzeCoralGarden, getNexusBaseUrl } from "@/lib/nexus-client"
import type { EvaCamera } from "@/types/eva"
import type { CoralAnalysisResult } from "@/types/coral"

type Status = "idle" | "capturing" | "analyzing" | "done" | "error"

const ERROR_MESSAGES: Record<string, string> = {
  ruler_not_found:
    "Righello arancione non rilevato. Inquadra il righello da 50 cm e riprova.",
  pvc_not_found:
    "Struttura PVC non isolata. Avvicinati o migliora l'illuminazione e riprova.",
  image_unreadable: "Immagine non leggibile.",
  cv_unavailable:
    "Pipeline CV non disponibile sul backend (submodule non inizializzato?).",
}

function errorLabel(result: CoralAnalysisResult | null, fallback: string) {
  if (result?.error && ERROR_MESSAGES[result.error]) {
    return ERROR_MESSAGES[result.error]
  }
  return fallback
}

export function EvaCoralCapture({ camera }: { camera: EvaCamera | null }) {
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<CoralAnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const busy = status === "capturing" || status === "analyzing"
  const canCapture = Boolean(camera?.stream && camera.enabled) && !busy

  const runCapture = useCallback(async () => {
    if (!camera?.stream) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setResult(null)
    setErrorMessage("")
    setDialogOpen(true)

    try {
      setStatus("capturing")
      const frame = await captureFrameFromStream(camera.stream)

      setStatus("analyzing")
      const analysis = await analyzeCoralGarden(frame, controller.signal)
      setResult(analysis)

      if (analysis.ok) {
        setStatus("done")
      } else {
        setStatus("error")
        setErrorMessage(errorLabel(analysis, "Analisi non riuscita."))
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Errore durante la cattura."
      )
    }
  }, [camera])

  const annotatedSrc =
    result?.annotated_url ? `${getNexusBaseUrl()}${result.annotated_url}` : null

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!canCapture}
        onClick={runCapture}
        title={
          canCapture
            ? "Cattura un frame e misura il coral garden"
            : "Nessuno stream camera disponibile"
        }
      >
        <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} data-icon="inline-start" />
        {busy ? "Analisi..." : "Coral Garden"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Coral Garden — Misurazione</DialogTitle>
            <DialogDescription>
              {status === "capturing" && "Cattura del frame in corso..."}
              {status === "analyzing" && "Analisi CV in corso..."}
              {status === "done" && "Misure rilevate dall'immagine catturata."}
              {status === "error" && errorMessage}
              {status === "idle" && "—"}
            </DialogDescription>
          </DialogHeader>

          {annotatedSrc && (
            <img
              src={annotatedSrc}
              alt="Coral garden annotato"
              className="w-full rounded-md border"
            />
          )}

          {status === "done" && result && (
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Lunghezza" value={result.length_cm} unit="cm" compact />
              <MetricCard label="Altezza" value={result.height_cm} unit="cm" compact />
              <MetricCard label="Target" value={result.targets_count} compact />
            </div>
          )}

          <DialogFooter showCloseButton>
            <Button
              type="button"
              variant="default"
              disabled={!canCapture}
              onClick={runCapture}
            >
              {busy ? "Analisi..." : "Ri-scatta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
