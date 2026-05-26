import type { ReactNode } from "react"

import type { CommandAckStatus, CommandItem } from "@politocean/ui/types"
import { AckStatus } from "@politocean/ui/components/controls/ack-status"
import { CommandButton } from "@politocean/ui/components/controls/command-button"
import { CommandGrid } from "@politocean/ui/components/controls/command-grid"
import { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle } from "@politocean/ui/components/primitives/panel"

export type CommandPanelProps = {
  title?: ReactNode
  description?: ReactNode
  commands: CommandItem[]
  columns?: 1 | 2 | 3 | 4
  lastAck?: {
    command?: ReactNode
    status?: CommandAckStatus
  }
  className?: string
}

export function CommandPanel({ title = "Commands", description, commands, columns = 2, lastAck, className }: CommandPanelProps) {
  return (
    <Panel className={className}>
      {(title || description) && (
        <PanelHeader>
          {title ? <PanelTitle>{title}</PanelTitle> : null}
          {description ? <PanelDescription>{description}</PanelDescription> : null}
        </PanelHeader>
      )}
      <PanelContent className="space-y-4">
        <CommandGrid columns={columns}>
          {commands.map((command, index) => (
            <CommandButton
              key={command.id ?? `${command.label}-${index}`}
              label={command.label}
              description={command.description}
              intent={command.intent}
              busy={command.busy}
              disabled={command.disabled}
              ack={command.ack}
              onClick={command.onClick}
            />
          ))}
        </CommandGrid>
        {lastAck ? <AckStatus command={lastAck.command} status={lastAck.status} /> : null}
      </PanelContent>
    </Panel>
  )
}
