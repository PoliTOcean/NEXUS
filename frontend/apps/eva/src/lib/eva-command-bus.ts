/**
 * Tiny typed pub/sub bridge for EVA task commands coming from the gamepad.
 *
 * The gamepad is read by the Python backend (utils_rov), which publishes a
 * command on the `eva_commands/` MQTT topic. The MQTT client lives in
 * use-eva-mission-state.ts, but the task panels (Crab/Coral) are self-contained
 * components rendered as siblings — they don't share state with the hook. This
 * module lets the hook re-emit a received command and each panel subscribe to it,
 * without window globals or extra dependencies.
 */

export type EvaCommand =
  | "CRAB_CAPTURE"
  | "CORAL_OPEN"
  | "CORAL_FRONT"
  | "CORAL_BACK"

type EvaCommandHandler = (command: EvaCommand) => void

const listeners = new Set<EvaCommandHandler>()

/** Dispatch a command to every subscribed panel. */
export function emitEvaCommand(command: EvaCommand) {
  for (const handler of listeners) {
    handler(command)
  }
}

/** Subscribe to EVA commands. Returns an unsubscribe function. */
export function onEvaCommand(handler: EvaCommandHandler): () => void {
  listeners.add(handler)
  return () => {
    listeners.delete(handler)
  }
}
