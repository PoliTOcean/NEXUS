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
import { Camera01Icon } from "@hugeicons/core-free-icons"

import { captureFrameFromStream } from "@/lib/capture-frame"
import { onEvaCommand } from "@/lib/eva-command-bus"
import { getNexusBaseUrl, reconstructCoralGarden } from "@/lib/nexus-client"
import type { EvaCamera } from "@/types/eva"
import type { CoralAnalysisResult } from "@/types/coral"

// Two-photo flow driven by the gamepad (D-pad Down / Y / A), see eva-command-bus:
//   armed         -> session open, waiting for the front/back photos
//   capturing     -> grabbing a frame
//   reconstructing-> both photos sent to the CV reconstruction
//   done/error    -> result shown
type Status = "idle" | "armed" | "capturing" | "reconstructing" | "done" | "error"

const ERROR_MESSAGES: Record<string, string> = {
  ruler_not_found:
    "Righello arancione non rilevato. Inquadra il righello da 50 cm e riprova.",
  pvc_not_found:
    "Struttura PVC non isolata. Avvicinati o migliora l'illuminazione e riprova.",
  image_unreadable: "Immagine non leggibile.",
  cv_unavailable:
    "Ricostruzione CV non disponibile sul backend (funzione 2-foto non ancora presente?).",
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
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null)
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null)
  const frontFrameRef = useRef<Blob | null>(null)
  const backFrameRef = useRef<Blob | null>(null)
  const frontPreviewUrlRef = useRef<string | null>(null)
  const backPreviewUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const busy = status === "capturing" || status === "reconstructing"
  const hasStream = Boolean(camera?.stream && camera.enabled)
  const hasFront = Boolean(frontPreviewUrl)
  const hasBack = Boolean(backPreviewUrl)
  const bothReady = hasFront && hasBack

  // Swap a preview object URL, revoking the previous one to avoid leaks.
  const setFrontPreview = useCallback((url: string | null) => {
    if (frontPreviewUrlRef.current) URL.revokeObjectURL(frontPreviewUrlRef.current)
    frontPreviewUrlRef.current = url
    setFrontPreviewUrl(url)
  }, [])
  const setBackPreview = useCallback((url: string | null) => {
    if (backPreviewUrlRef.current) URL.revokeObjectURL(backPreviewUrlRef.current)
    backPreviewUrlRef.current = url
    setBackPreviewUrl(url)
  }, [])

  // D-pad Down (CORAL_OPEN) / reset button: start over, clear both photos.
  const openSession = useCallback(() => {
    abortRef.current?.abort()
    frontFrameRef.current = null
    backFrameRef.current = null
    setFrontPreview(null)
    setBackPreview(null)
    setResult(null)
    setErrorMessage("")
    setStatus("armed")
  }, [setFrontPreview, setBackPreview])

  // Send the FRONT + BACK pair to the CV reconstruction.
  const reconstruct = useCallback(async () => {
    const front = frontFrameRef.current
    const back = backFrameRef.current
    if (!front || !back) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setResult(null)
    setErrorMessage("")

    try {
      setStatus("reconstructing")
      const analysis = await reconstructCoralGarden(front, back, controller.signal)
      setResult(analysis)

      if (analysis.ok) {
        setStatus("done")
      } else {
        setStatus("error")
        setErrorMessage(errorLabel(analysis, "Ricostruzione non riuscita."))
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Errore durante la ricostruzione."
      )
    }
  }, [])

  // Y / A: capture into the front/back slot; auto-reconstruct once both exist.
  const captureSlot = useCallback(
    async (slot: "front" | "back") => {
      if (!camera?.stream) return

      try {
        setStatus("capturing")
        const frame = await captureFrameFromStream(camera.stream)
        if (slot === "front") {
          frontFrameRef.current = frame
          setFrontPreview(URL.createObjectURL(frame))
        } else {
          backFrameRef.current = frame
          setBackPreview(URL.createObjectURL(frame))
        }
        setResult(null)
        setErrorMessage("")

        if (frontFrameRef.current && backFrameRef.current) {
          await reconstruct()
        } else {
          setStatus("armed")
        }
      } catch (error) {
        setStatus("error")
        setErrorMessage(
          error instanceof Error ? error.message : "Errore durante la cattura."
        )
      }
    },
    [camera, reconstruct, setFrontPreview, setBackPreview]
  )

  const captureFront = useCallback(() => captureSlot("front"), [captureSlot])
  const captureBack = useCallback(() => captureSlot("back"), [captureSlot])

  // Gamepad bus: subscribe once, route to the latest handlers via a ref.
  const handlersRef = useRef({ openSession, captureFront, captureBack })
  useEffect(() => {
    handlersRef.current = { openSession, captureFront, captureBack }
  }, [openSession, captureFront, captureBack])

  useEffect(() => {
    return onEvaCommand((command) => {
      const handlers = handlersRef.current
      if (command === "CORAL_OPEN") handlers.openSession()
      else if (command === "CORAL_FRONT") void handlers.captureFront()
      else if (command === "CORAL_BACK") void handlers.captureBack()
    })
  }, [])

  // Revoke the preview object URLs on unmount.
  useEffect(() => {
    return () => {
      if (frontPreviewUrlRef.current) URL.revokeObjectURL(frontPreviewUrlRef.current)
      if (backPreviewUrlRef.current) URL.revokeObjectURL(backPreviewUrlRef.current)
    }
  }, [])

  const annotatedSrc =
    result?.annotated_url ? `${getNexusBaseUrl()}${result.annotated_url}` : null

  return (
    <Panel className="shrink-0 bg-card/70">
      <PanelHeader className="flex items-center justify-between gap-2 space-y-0 p-3">
        <PanelTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-4" />
          Coral Garden
        </PanelTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openSession}
          title="Azzera la sessione (D-pad Giù)"
        >
          Reset
        </Button>
      </PanelHeader>

      <PanelContent className="space-y-2 p-3 pt-0">
        <p className="text-xs text-muted-foreground">
          {status === "capturing" && "Cattura del frame in corso..."}
          {status === "reconstructing" && "Ricostruzione CV (fronte + retro) in corso..."}
          {status === "done" && "Coral garden ricostruito dalle due viste."}
          {status === "error" && errorMessage}
          {(status === "idle" || status === "armed") &&
            "Y = fronte · A = retro · con entrambe parte da sola."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!hasStream || busy}
              onClick={captureFront}
            >
              {hasFront ? "Ri-scatta fronte (Y)" : "Scatta fronte (Y)"}
            </Button>
            {frontPreviewUrl ? (
              <img
                src={frontPreviewUrl}
                alt="Fronte"
                className="aspect-video w-full rounded-md border object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                Fronte
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!hasStream || busy}
              onClick={captureBack}
            >
              {hasBack ? "Ri-scatta retro (A)" : "Scatta retro (A)"}
            </Button>
            {backPreviewUrl ? (
              <img
                src={backPreviewUrl}
                alt="Retro"
                className="aspect-video w-full rounded-md border object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                Retro
              </div>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          size="sm"
          className="w-full"
          disabled={!bothReady || busy}
          onClick={reconstruct}
        >
          {status === "reconstructing" ? "Ricostruzione..." : "Ricostruisci"}
        </Button>

        {annotatedSrc && (
          <img
            src={annotatedSrc}
            alt="Coral garden ricostruito"
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
      </PanelContent>
    </Panel>
  )
}
