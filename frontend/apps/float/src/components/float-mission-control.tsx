import { type FormEvent, useMemo, useState } from "react"
import {
  Button,
  CommandPanel,
  DataViewer,
  FloatProfileChart,
  LogViewer,
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  ParameterInput,
  StatusBadge,
  StatusOverviewPanel,
} from "@politocean/ui"

import { useFloatMissionState } from "@/hooks/use-float-mission-state"
import type { FloatPackageState, FloatProfileData } from "@/types/float"

const PARAMETER_RADIUS_CLASS = "rounded-md"

function formatPackageValue(value: unknown) {
  if (value === null || value === undefined) return "N/A"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return JSON.stringify(value)
}

function FloatParameterPanel({
  disabled,
  onSendPid,
  onSendTestFrequency,
  onSendTestSteps,
}: {
  disabled: boolean
  onSendPid: (kp: string, ki: string, kd: string) => void
  onSendTestFrequency: (frequency: string) => void
  onSendTestSteps: (steps: string) => void
}) {
  const [kp, setKp] = useState("")
  const [ki, setKi] = useState("")
  const [kd, setKd] = useState("")
  const [frequency, setFrequency] = useState("")
  const [steps, setSteps] = useState("")

  function handlePidSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSendPid(kp, ki, kd)
  }

  function handleFrequencySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSendTestFrequency(frequency)
  }

  function handleStepsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSendTestSteps(steps)
  }

  return (
    <Panel className={`bg-card/70 ${PARAMETER_RADIUS_CLASS}`}>
      <PanelHeader>
        <PanelTitle>Parameters</PanelTitle>
        <PanelDescription>PID and float test commands</PanelDescription>
      </PanelHeader>
      <PanelContent className="space-y-4">
        <form className="space-y-3" onSubmit={handlePidSubmit}>
          <div className="grid grid-cols-3 gap-2">
            <ParameterInput
              label="Kp"
              type="number"
              inputMode="decimal"
              placeholder="Enter Kp"
              rounding="left"
              value={kp}
              disabled={disabled}
              onChange={(event) => {
                setKp(event.target.value)
              }}
            />
            <ParameterInput
              label="Ki"
              type="number"
              inputMode="decimal"
              placeholder="Enter Ki"
              rounding="none"
              value={ki}
              disabled={disabled}
              onChange={(event) => {
                setKi(event.target.value)
              }}
            />
            <ParameterInput
              label="Kd"
              type="number"
              inputMode="decimal"
              placeholder="Enter Kd"
              rounding="right"
              value={kd}
              disabled={disabled}
              onChange={(event) => {
                setKd(event.target.value)
              }}
            />
          </div>
          <Button
            type="submit"
            className={`w-full ${PARAMETER_RADIUS_CLASS}`}
            disabled={disabled}
          >
            SET PID
          </Button>
        </form>

        <form onSubmit={handleFrequencySubmit}>
          <ParameterInput
            label="Test Freq"
            type="number"
            inputMode="numeric"
            placeholder="Enter frequency"
            helperText="Required before sending"
            action={
              <Button
                type="submit"
                disabled={disabled}
                className={`h-9 min-w-20 ${PARAMETER_RADIUS_CLASS}`}
              >
                SET
              </Button>
            }
            value={frequency}
            disabled={disabled}
            onChange={(event) => {
              setFrequency(event.target.value)
            }}
          />
        </form>

        <form onSubmit={handleStepsSubmit}>
          <ParameterInput
            label="Test Steps"
            type="number"
            inputMode="numeric"
            placeholder="Enter steps"
            helperText="Required before sending"
            action={
              <Button
                type="submit"
                disabled={disabled}
                className={`h-9 min-w-20 ${PARAMETER_RADIUS_CLASS}`}
              >
                RUN
              </Button>
            }
            value={steps}
            disabled={disabled}
            onChange={(event) => {
              setSteps(event.target.value)
            }}
          />
        </form>
      </PanelContent>
    </Panel>
  )
}

function FloatPackagePanel({ packageData }: { packageData: FloatPackageState | null }) {
  if (!packageData) {
    return (
      <Panel className="min-h-0 bg-card/70">
        <PanelHeader>
          <PanelTitle>Test Package</PanelTitle>
          <PanelDescription>No package received yet.</PanelDescription>
        </PanelHeader>
      </Panel>
    )
  }

  if (
    !packageData.parsed ||
    typeof packageData.parsed !== "object" ||
    Array.isArray(packageData.parsed)
  ) {
    return (
      <DataViewer
        title="Test Package"
        content={packageData.raw}
        variant="code"
        maxHeight={220}
        className="min-h-0 bg-card/70"
      />
    )
  }

  const payload = packageData.parsed as Record<string, unknown>
  const rows = Object.entries(payload)

  return (
    <Panel className="min-h-0 bg-card/70">
      <PanelHeader>
        <PanelTitle>Test Package</PanelTitle>
        <PanelDescription>Last SEND_PACKAGE response</PanelDescription>
      </PanelHeader>
      <PanelContent>
        <div className="max-h-72 overflow-auto rounded-md border bg-muted/20">
          <table className="w-full text-left text-sm">
            <tbody>
              {rows.map(([key, value]) => (
                <tr key={key} className="border-b last:border-0">
                  <th className="w-36 px-3 py-2 align-top text-xs font-medium text-muted-foreground">
                    {key}
                  </th>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">
                    {formatPackageValue(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelContent>
    </Panel>
  )
}

function createProfilePoints(profileData: FloatProfileData | null) {
  const raw = profileData?.raw
  if (!raw?.times?.length) return []

  return raw.times.map((timestamp, index) => ({
    timestamp,
    depth: raw.depth_m?.[index] ?? raw.depth?.[index],
    pressure: raw.pressure_kpa?.[index] ?? raw.pressure?.[index],
  }))
}

function FloatProfilePanel({
  data,
  statusText,
  canFetch,
  fetching,
  onFetch,
}: {
  data: FloatProfileData | null
  statusText: string
  canFetch: boolean
  fetching: boolean
  onFetch: () => void
}) {
  const profilePoints = useMemo(() => createProfilePoints(data), [data])

  return (
    <Panel className="flex min-h-0 flex-col bg-card/70">
      <PanelHeader className="flex shrink-0 flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <PanelTitle>Profile Data Log</PanelTitle>
          <PanelDescription>{statusText}</PanelDescription>
        </div>
        <Button
          type="button"
          disabled={!canFetch || fetching}
          onClick={onFetch}
          className="shrink-0"
        >
          {fetching ? "FETCHING..." : "FETCH STORED DATA"}
        </Button>
      </PanelHeader>
      <PanelContent className="min-h-0 flex-1">
        <FloatProfileChart
          title="Depth / Pressure"
          description={data?.error_message ?? "Depth in m, pressure in kPa. Raw payload also includes profile id, phase, and sensor depth."}
          data={profilePoints}
          pressureUnit="kPa"
          className="h-full rounded-md border bg-muted/20 shadow-none"
          chartClassName="h-full"
        />
      </PanelContent>
    </Panel>
  )
}

export function FloatMissionControl() {
  const {
    commands,
    fetchProfileData,
    isBusy,
    isFetchingProfile,
    sendPidParams,
    sendTestFrequency,
    sendTestSteps,
    state,
  } = useFloatMissionState()

  return (
    <main className="h-svh bg-background text-foreground">
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border bg-card/70 px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Float Mission Control
            </h1>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              FLOAT / Live Backend
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state.connections.map((connection) => (
              <StatusBadge
                key={connection.id}
                status={connection.status}
                label={`${connection.label}: ${connection.detail}`}
                pulse={
                  connection.status === "success" ||
                  connection.status === "loading"
                }
              />
            ))}
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden pr-1">
            <StatusOverviewPanel
              title="Float Status"
              description="Parsed from /FLOAT/status"
              items={state.statusItems}
              compact
              className="bg-card/70"
            />

            <FloatPackagePanel packageData={state.packageData} />
          </aside>

          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
            <LogViewer
              title="Raw Serial Debug Log"
              lines={state.logs}
              maxHeight={150}
              className="min-h-0 bg-card/70"
            />

            <FloatProfilePanel
              data={state.profile.data}
              statusText={state.profile.statusText}
              canFetch={state.dataAvailable && !isBusy}
              fetching={isFetchingProfile}
              onFetch={() => {
                void fetchProfileData()
              }}
            />
          </div>

          <aside className="flex min-h-0 flex-col gap-3 overflow-auto pl-1">
            <CommandPanel
              title="Commands"
              description="FLOAT mission command set"
              commands={commands}
              columns={2}
              lastAck={state.lastAck}
              className="bg-card/70"
            />

            <FloatParameterPanel
              disabled={isBusy}
              onSendPid={sendPidParams}
              onSendTestFrequency={sendTestFrequency}
              onSendTestSteps={sendTestSteps}
            />
          </aside>
        </section>
      </div>
    </main>
  )
}
