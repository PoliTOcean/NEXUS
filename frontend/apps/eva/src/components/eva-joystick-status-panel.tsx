import {
  Button,
  CommandsCard,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@politocean/ui"
import { GameController03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { EvaJoystickCommandStatus } from "@/types/eva"

type EvaJoystickStatusPanelProps = {
  statuses: EvaJoystickCommandStatus[]
  onOpenControllerMap: () => void
}

export function EvaJoystickStatusPanel({
  statuses,
  onOpenControllerMap,
}: EvaJoystickStatusPanelProps) {
  return (
    <Panel className="shrink-0 bg-card/70">
      <PanelHeader className="flex items-center justify-between gap-2 space-y-0 p-3">
        <PanelTitle>Joystick</PanelTitle>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Open controller map"
          onClick={onOpenControllerMap}
        >
          <HugeiconsIcon icon={GameController03Icon} strokeWidth={2} />
        </Button>
      </PanelHeader>
      <PanelContent className="grid grid-cols-3 gap-2 p-3 pt-0">
        {statuses.map((item) => (
          <CommandsCard
            key={item.id}
            label={item.label}
            status={item.status}
            compact
            className="min-h-12"
          />
        ))}
      </PanelContent>
    </Panel>
  )
}
