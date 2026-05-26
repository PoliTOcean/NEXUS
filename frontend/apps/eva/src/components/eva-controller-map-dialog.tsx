import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@politocean/ui"

import controllerMapUrl from "@/assets/controller/xbox_controller_map.svg"

type EvaControllerMapDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EvaControllerMapDialog({
  open,
  onOpenChange,
}: EvaControllerMapDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-4 overflow-hidden p-4 sm:max-w-[min(1200px,calc(100vw-2rem))]">
        <DialogHeader className="pr-10">
          <DialogTitle>Controller Map</DialogTitle>
          <DialogDescription>
            Xbox controller command mapping generated from NEXUS joystick
            configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 items-center justify-center overflow-auto rounded-md border bg-white p-3">
          <img
            src={controllerMapUrl}
            alt="Xbox controller command map"
            className="h-auto max-h-[calc(100svh-11rem)] w-full max-w-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
