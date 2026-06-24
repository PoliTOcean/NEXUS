import { useCallback, useEffect, useRef, useState } from "react"

import {
  Button,
  MetricCard,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@politocean/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { CrabIcon } from "@hugeicons/core-free-icons"

import { captureFrameFromStream } from "@/lib/capture-frame"
import { onEvaCommand } from "@/lib/eva-command-bus"
import { analyzeCrabSample, getNexusBaseUrl } from "@/lib/nexus-client"
import type { EvaCamera } from "@/types/eva"
import type { CrabAnalysisResult } from "@/types/crab"

type Status = "idle" | "capturing" | "analyzing" | "done" | "error"

const ERROR_MESSAGES: Record<string, string> = {
  image_unreadable: "Immagine non leggibile.",
  cv_unavailable:
    "Modello YOLO non disponibile sul backend (ultralytics/submodule non installato?).",
}

function errorLabel(result: CrabAnalysisResult | null, fallback: string) {
  if (result?.error && ERROR_MESSAGES[result.error]) {
    return ERROR_MESSAGES[result.error]
  }
  return fallback
}

export function EvaCrabCapture({ camera }: { camera: EvaCamera | null }) {
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<CrabAnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
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

    try {
      setStatus("capturing")
      const frame = await captureFrameFromStream(camera.stream)

      setStatus("analyzing")
      const analysis = await analyzeCrabSample(frame, controller.signal)
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

  // Gamepad: D-pad Up (CRAB_CAPTURE) fires the capture automatically. Keep a ref
  // to the latest runCapture so we subscribe to the bus only once.
  const runCaptureRef = useRef(runCapture)
  useEffect(() => {
    runCaptureRef.current = runCapture
  }, [runCapture])

  useEffect(() => {
    return onEvaCommand((command) => {
      if (command === "CRAB_CAPTURE") void runCaptureRef.current()
    })
  }, [])

  const annotatedSrc =
    result?.annotated_url ? `${getNexusBaseUrl()}${result.annotated_url}` : null

  return (
    <Panel className="shrink-0 bg-card/70">
      <PanelHeader className="flex items-center justify-between gap-2 space-y-0 p-3">
        <PanelTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={CrabIcon} strokeWidth={2} className="size-4" />
          Crab Counter
        </PanelTitle>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canCapture}
          onClick={runCapture}
          title={
            canCapture
              ? "Cattura un frame e conta i granchi verdi invasivi (D-pad Su)"
              : "Nessuno stream camera disponibile"
          }
        >
          {busy ? "Analisi..." : "Scatta"}
        </Button>
      </PanelHeader>

      <PanelContent className="space-y-2 p-3 pt-0">
        <p className="text-xs text-muted-foreground">
          {status === "capturing" && "Cattura del frame in corso..."}
          {status === "analyzing" && "Inferenza YOLOv8 in corso..."}
          {status === "done" && "Granchi verdi invasivi rilevati nel campione."}
          {status === "error" && errorMessage}
          {status === "idle" && "D-pad Su per scattare e contare."}
        </p>

        {annotatedSrc && (
          <img
            src={annotatedSrc}
            alt="Campione granchi annotato"
            className="w-full rounded-md border"
          />
        )}

        {status === "done" && result && (
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="Green crabs (invasivi)"
              value={result.green_count}
              compact
            />
            <MetricCard
              label="Rilevamenti totali"
              value={result.total_detections}
              compact
            />
          </div>
        )}
      </PanelContent>
    </Panel>
  )
}
