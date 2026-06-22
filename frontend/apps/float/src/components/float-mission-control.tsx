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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  StatusOverviewPanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@politocean/ui"

import { useFloatMissionState } from "@/hooks/use-float-mission-state"
import type {
  FloatPackageState,
  FloatProfileData,
  FloatRuntimeBalanceConfig,
  FloatRuntimeMotorConfig,
  FloatRuntimePidConfig,
  FloatRuntimeProfile,
} from "@/types/float"

const PARAMETER_RADIUS_CLASS = "rounded-md"
const FLOAT_LENGTH_M = 0.51

const MATE_PROFILE: FloatRuntimeProfile = {
  profile_count: 2,
  descent_target_m: 2.5,
  ascent_target_m: 0.4,
  ascent_target_bottom_m: 0.91,
  depth_tolerance_m: 0.33,
  hold_s: 30,
  descent_timeout_s: 180,
  ascent_timeout_s: 120,
  surface_rest_offset_m: 0.1,
}

const POOL_PROFILE: FloatRuntimeProfile = {
  profile_count: 1,
  descent_target_m: 0.63,
  ascent_target_m: 0.06,
  ascent_target_bottom_m: 0.57,
  depth_tolerance_m: 0.025,
  hold_s: 8,
  descent_timeout_s: 45,
  ascent_timeout_s: 45,
  surface_rest_offset_m: 0.1,
}

function formatPackageValue(value: unknown) {
  if (value === null || value === undefined) return "N/A"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return JSON.stringify(value)
}

type ProfileFormState = Record<
  | "profile_count"
  | "descent_target_m"
  | "ascent_target_m"
  | "depth_tolerance_m"
  | "hold_s"
  | "descent_timeout_s"
  | "ascent_timeout_s"
  | "surface_rest_offset_m",
  string
>

function profileToForm(profile: FloatRuntimeProfile): ProfileFormState {
  return {
    profile_count: String(profile.profile_count),
    descent_target_m: String(profile.descent_target_m),
    ascent_target_m: String(profile.ascent_target_m),
    depth_tolerance_m: String(profile.depth_tolerance_m),
    hold_s: String(profile.hold_s),
    descent_timeout_s: String(profile.descent_timeout_s),
    ascent_timeout_s: String(profile.ascent_timeout_s),
    surface_rest_offset_m: String(profile.surface_rest_offset_m),
  }
}

function formToProfile(form: ProfileFormState): FloatRuntimeProfile {
  const ascentTarget = Number(form.ascent_target_m)

  return {
    profile_count: Number(form.profile_count),
    descent_target_m: Number(form.descent_target_m),
    ascent_target_m: ascentTarget,
    ascent_target_bottom_m: ascentTarget + FLOAT_LENGTH_M,
    depth_tolerance_m: Number(form.depth_tolerance_m),
    hold_s: Number(form.hold_s),
    descent_timeout_s: Number(form.descent_timeout_s),
    ascent_timeout_s: Number(form.ascent_timeout_s),
    surface_rest_offset_m: Number(form.surface_rest_offset_m),
  }
}

function formatMeters(value: number) {
  return Number.isFinite(value) ? `${value.toFixed(3)} m` : "N/A"
}

function FloatParameterPanel({
  disabled,
  onSendTestSteps,
}: {
  disabled: boolean
  onSendTestSteps: (steps: string) => void
}) {
  const [steps, setSteps] = useState("")

  function handleStepsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSendTestSteps(steps)
  }

  return (
    <Panel className={`bg-card/70 ${PARAMETER_RADIUS_CLASS}`}>
      <PanelHeader>
        <PanelTitle>Manual Tests</PanelTitle>
        <PanelDescription>One-shot FLOAT test commands</PanelDescription>
      </PanelHeader>
      <PanelContent className="space-y-4">
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

function FloatSyringePanel({
  disabled,
  onApply,
}: {
  disabled: boolean
  onApply: (uNorm: number, durationS: number) => Promise<boolean>
}) {
  const [position, setPosition] = useState("0.5")
  const [duration, setDuration] = useState("10")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onApply(Number(position), Number(duration))
  }

  return (
    <Panel className={`bg-card/70 ${PARAMETER_RADIUS_CLASS}`}>
      <PanelHeader>
        <PanelTitle>Syringe Control</PanelTitle>
        <PanelDescription>Direct SYRINGE_SET command</PanelDescription>
      </PanelHeader>
      <PanelContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <ParameterInput
            label="Position"
            unit="u"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={1}
            helperText="0 = retracted (float), 1 = extended (sink)"
            value={position}
            disabled={disabled}
            onChange={(event) => setPosition(event.target.value)}
          />
          <ParameterInput
            label="Duration"
            unit="s"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0.5}
            max={300}
            helperText="Valid range 0.5–300 s"
            value={duration}
            disabled={disabled}
            onChange={(event) => setDuration(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={disabled}
              className={`min-w-28 ${PARAMETER_RADIUS_CLASS}`}
            >
              SET SYRINGE
            </Button>
          </div>
        </form>
      </PanelContent>
    </Panel>
  )
}

function FloatPidHoldPanel({
  disabled,
  onApply,
}: {
  disabled: boolean
  onApply: (depthM: number, durationS: number) => Promise<boolean>
}) {
  const [depth, setDepth] = useState("2.5")
  const [duration, setDuration] = useState("30")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onApply(Number(depth), Number(duration))
  }

  return (
    <Panel className={`bg-card/70 ${PARAMETER_RADIUS_CLASS}`}>
      <PanelHeader>
        <PanelTitle>PID Depth Hold</PanelTitle>
        <PanelDescription>Direct PID_HOLD command</PanelDescription>
      </PanelHeader>
      <PanelContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <ParameterInput
            label="Depth"
            unit="m"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0.1}
            max={5}
            helperText="Float-top depth, valid range 0.1–5.0 m"
            value={depth}
            disabled={disabled}
            onChange={(event) => setDepth(event.target.value)}
          />
          <ParameterInput
            label="Duration"
            unit="s"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0.5}
            max={300}
            helperText="Hold time, valid range 0.5–300 s"
            value={duration}
            disabled={disabled}
            onChange={(event) => setDuration(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={disabled}
              className={`min-w-28 ${PARAMETER_RADIUS_CLASS}`}
            >
              HOLD DEPTH
            </Button>
          </div>
        </form>
      </PanelContent>
    </Panel>
  )
}

function FloatRuntimeProfilePanel({
  profile,
  statusText,
  disabled,
  onApply,
  onRefresh,
}: {
  profile: FloatRuntimeProfile | null
  statusText: string
  disabled: boolean
  onApply: (profile: FloatRuntimeProfile) => Promise<boolean>
  onRefresh: () => void
}) {
  const resolvedProfile = profile ?? MATE_PROFILE
  const [preset, setPreset] = useState("custom")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [form, setForm] = useState<ProfileFormState>(() =>
    profileToForm(resolvedProfile)
  )

  const parsedProfile = useMemo(() => formToProfile(form), [form])
  const ascentBottom = parsedProfile.ascent_target_bottom_m ?? parsedProfile.ascent_target_m + FLOAT_LENGTH_M

  function updateField(field: keyof ProfileFormState, value: string) {
    setPreset("custom")
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  function handlePresetChange(value: string) {
    setPreset(value)
    if (value === "pool70") {
      setForm(profileToForm(POOL_PROFILE))
      return
    }
    if (value === "mate") {
      setForm(profileToForm(MATE_PROFILE))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const applied = await onApply(parsedProfile)
    if (applied) setPreset("custom")
  }

  return (
    <Panel className="min-h-0 bg-card/70">
      <PanelHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <PanelTitle>Profile</PanelTitle>
          <PanelDescription>{statusText}</PanelDescription>
        </div>
        <Button
          type="button"
          disabled={disabled}
          onClick={onRefresh}
          className={PARAMETER_RADIUS_CLASS}
        >
          REFRESH
        </Button>
      </PanelHeader>
      <PanelContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preset
              </div>
              <Select value={preset} onValueChange={handlePresetChange} disabled={disabled}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pool70">Pool 70 cm</SelectItem>
                  <SelectItem value="mate">MATE</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Descent target</div>
                <div className="font-mono text-sm tabular-nums">
                  {formatMeters(parsedProfile.descent_target_m)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Ascent bottom</div>
                <div className="font-mono text-sm tabular-nums">
                  {formatMeters(ascentBottom)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Profiles</div>
                <div className="font-mono text-sm tabular-nums">
                  {parsedProfile.profile_count || "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Essential parameters: the 4 fields the operator normally touches. */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ParameterInput
              label="Descent Target"
              unit="m"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={form.descent_target_m}
              disabled={disabled}
              onChange={(event) => updateField("descent_target_m", event.target.value)}
            />
            <ParameterInput
              label="Ascent Target"
              unit="m"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={form.ascent_target_m}
              disabled={disabled}
              onChange={(event) => updateField("ascent_target_m", event.target.value)}
            />
            <ParameterInput
              label="Tolerance"
              unit="m"
              type="number"
              inputMode="decimal"
              step="0.001"
              value={form.depth_tolerance_m}
              disabled={disabled}
              onChange={(event) => updateField("depth_tolerance_m", event.target.value)}
            />
            <ParameterInput
              label="Hold"
              unit="s"
              type="number"
              inputMode="decimal"
              step="1"
              value={form.hold_s}
              disabled={disabled}
              onChange={(event) => updateField("hold_s", event.target.value)}
            />
          </div>

          {/* Advanced parameters: collapsed by default, pre-filled with defaults. */}
          <div className="space-y-3">
            <button
              type="button"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced((open) => !open)}
            >
              {showAdvanced ? "▾ Advanced" : "▸ Advanced"}
            </button>
            {showAdvanced ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ParameterInput
                  label="Profile Count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  value={form.profile_count}
                  disabled={disabled}
                  onChange={(event) => updateField("profile_count", event.target.value)}
                />
                <ParameterInput
                  label="Descent Timeout"
                  unit="s"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  value={form.descent_timeout_s}
                  disabled={disabled}
                  onChange={(event) => updateField("descent_timeout_s", event.target.value)}
                />
                <ParameterInput
                  label="Ascent Timeout"
                  unit="s"
                  type="number"
                  inputMode="decimal"
                  step="1"
                  value={form.ascent_timeout_s}
                  disabled={disabled}
                  onChange={(event) => updateField("ascent_timeout_s", event.target.value)}
                />
                <ParameterInput
                  label="Surface Rest Offset"
                  unit="m"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.surface_rest_offset_m}
                  disabled={disabled}
                  onChange={(event) => updateField("surface_rest_offset_m", event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={disabled}
              className={`min-w-36 ${PARAMETER_RADIUS_CLASS}`}
            >
              APPLY PROFILE
            </Button>
          </div>
        </form>
      </PanelContent>
    </Panel>
  )
}

const DEFAULT_PID_CONFIG: FloatRuntimePidConfig = {
  kp: 0.17,
  ki: 0,
  kd: 0.13,
  period_ms: 50,
  alpha_d: 0.25,
  integral_limit: 5,
  min_retarget_frac: 0.001,
  u_neutral: 0.011,
}

const DEFAULT_BALANCE_CONFIG: FloatRuntimeBalanceConfig = {
  hold_ms: 5000,
  stop_delta_kpa: 5,
  stop_samples: 3,
  sample_period_ms: 50,
}

const DEFAULT_MOTOR_CONFIG: FloatRuntimeMotorConfig = {
  max_speed: 1800,
  max_accel: 1800,
  homing_speed: 1800,
  test_speed: 1800,
}

type PidConfigFormState = Record<keyof FloatRuntimePidConfig, string>
type BalanceConfigFormState = Record<keyof FloatRuntimeBalanceConfig, string>
type MotorConfigFormState = Record<keyof FloatRuntimeMotorConfig, string>

function pidConfigToForm(config: FloatRuntimePidConfig): PidConfigFormState {
  return {
    kp: String(config.kp),
    ki: String(config.ki),
    kd: String(config.kd),
    period_ms: String(config.period_ms),
    alpha_d: String(config.alpha_d),
    integral_limit: String(config.integral_limit),
    min_retarget_frac: String(config.min_retarget_frac),
    u_neutral: String(config.u_neutral),
  }
}

function balanceConfigToForm(config: FloatRuntimeBalanceConfig): BalanceConfigFormState {
  return {
    hold_ms: String(config.hold_ms),
    stop_delta_kpa: String(config.stop_delta_kpa),
    stop_samples: String(config.stop_samples),
    sample_period_ms: String(config.sample_period_ms),
  }
}

function motorConfigToForm(config: FloatRuntimeMotorConfig): MotorConfigFormState {
  return {
    max_speed: String(config.max_speed),
    max_accel: String(config.max_accel),
    homing_speed: String(config.homing_speed),
    test_speed: String(config.test_speed),
  }
}

function formToPidConfig(form: PidConfigFormState): FloatRuntimePidConfig {
  return {
    kp: Number(form.kp),
    ki: Number(form.ki),
    kd: Number(form.kd),
    period_ms: Number(form.period_ms),
    alpha_d: Number(form.alpha_d),
    integral_limit: Number(form.integral_limit),
    min_retarget_frac: Number(form.min_retarget_frac),
    u_neutral: Number(form.u_neutral),
  }
}

function formToBalanceConfig(form: BalanceConfigFormState): FloatRuntimeBalanceConfig {
  return {
    hold_ms: Number(form.hold_ms),
    stop_delta_kpa: Number(form.stop_delta_kpa),
    stop_samples: Number(form.stop_samples),
    sample_period_ms: Number(form.sample_period_ms),
  }
}

function formToMotorConfig(form: MotorConfigFormState): FloatRuntimeMotorConfig {
  return {
    max_speed: Number(form.max_speed),
    max_accel: Number(form.max_accel),
    homing_speed: Number(form.homing_speed),
    test_speed: Number(form.test_speed),
  }
}

function FloatPidConfigPanel({
  config,
  statusText,
  disabled,
  onApply,
  onRefresh,
}: {
  config: FloatRuntimePidConfig | null
  statusText: string
  disabled: boolean
  onApply: (config: FloatRuntimePidConfig) => Promise<boolean>
  onRefresh: () => void
}) {
  const [form, setForm] = useState<PidConfigFormState>(() =>
    pidConfigToForm(config ?? DEFAULT_PID_CONFIG)
  )

  function updateField(field: keyof PidConfigFormState, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onApply(formToPidConfig(form))
  }

  return (
    <Panel className="bg-card/70">
      <PanelHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <PanelTitle>PID</PanelTitle>
          <PanelDescription>{statusText}</PanelDescription>
        </div>
        <Button type="button" disabled={disabled} onClick={onRefresh} className={PARAMETER_RADIUS_CLASS}>
          REFRESH
        </Button>
      </PanelHeader>
      <PanelContent>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {([
              ["kp", "Kp", "decimal"],
              ["ki", "Ki", "decimal"],
              ["kd", "Kd", "decimal"],
              ["period_ms", "Period", "numeric"],
              ["alpha_d", "Alpha D", "decimal"],
              ["integral_limit", "Integral Limit", "decimal"],
              ["min_retarget_frac", "Min Retarget", "decimal"],
              ["u_neutral", "Neutral U", "decimal"],
            ] as const).map(([field, label, inputMode]) => (
              <ParameterInput
                key={field}
                label={label}
                unit={field === "period_ms" ? "ms" : undefined}
                type="number"
                inputMode={inputMode}
                step={inputMode === "numeric" ? "1" : "0.001"}
                value={form[field]}
                disabled={disabled}
                onChange={(event) => updateField(field, event.target.value)}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={disabled} className={`min-w-36 ${PARAMETER_RADIUS_CLASS}`}>
              APPLY PID
            </Button>
          </div>
        </form>
      </PanelContent>
    </Panel>
  )
}

function FloatBalanceConfigPanel({
  config,
  statusText,
  disabled,
  onApply,
  onRefresh,
}: {
  config: FloatRuntimeBalanceConfig | null
  statusText: string
  disabled: boolean
  onApply: (config: FloatRuntimeBalanceConfig) => Promise<boolean>
  onRefresh: () => void
}) {
  const [form, setForm] = useState<BalanceConfigFormState>(() =>
    balanceConfigToForm(config ?? DEFAULT_BALANCE_CONFIG)
  )

  function updateField(field: keyof BalanceConfigFormState, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onApply(formToBalanceConfig(form))
  }

  return (
    <Panel className="bg-card/70">
      <PanelHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <PanelTitle>Balance</PanelTitle>
          <PanelDescription>{statusText}</PanelDescription>
        </div>
        <Button type="button" disabled={disabled} onClick={onRefresh} className={PARAMETER_RADIUS_CLASS}>
          REFRESH
        </Button>
      </PanelHeader>
      <PanelContent>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ParameterInput label="Hold" unit="ms" type="number" inputMode="numeric" value={form.hold_ms} disabled={disabled} onChange={(event) => updateField("hold_ms", event.target.value)} />
            <ParameterInput label="Stop Delta" unit="kPa" type="number" inputMode="decimal" step="0.1" value={form.stop_delta_kpa} disabled={disabled} onChange={(event) => updateField("stop_delta_kpa", event.target.value)} />
            <ParameterInput label="Stop Samples" type="number" inputMode="numeric" value={form.stop_samples} disabled={disabled} onChange={(event) => updateField("stop_samples", event.target.value)} />
            <ParameterInput label="Sample Period" unit="ms" type="number" inputMode="numeric" value={form.sample_period_ms} disabled={disabled} onChange={(event) => updateField("sample_period_ms", event.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={disabled} className={`min-w-36 ${PARAMETER_RADIUS_CLASS}`}>
              APPLY BALANCE
            </Button>
          </div>
        </form>
      </PanelContent>
    </Panel>
  )
}

function FloatMotorConfigPanel({
  config,
  statusText,
  disabled,
  onApply,
  onRefresh,
}: {
  config: FloatRuntimeMotorConfig | null
  statusText: string
  disabled: boolean
  onApply: (config: FloatRuntimeMotorConfig) => Promise<boolean>
  onRefresh: () => void
}) {
  const [form, setForm] = useState<MotorConfigFormState>(() =>
    motorConfigToForm(config ?? DEFAULT_MOTOR_CONFIG)
  )

  function updateField(field: keyof MotorConfigFormState, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onApply(formToMotorConfig(form))
  }

  return (
    <Panel className="bg-card/70">
      <PanelHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <PanelTitle>Motor</PanelTitle>
          <PanelDescription>{statusText}</PanelDescription>
        </div>
        <Button type="button" disabled={disabled} onClick={onRefresh} className={PARAMETER_RADIUS_CLASS}>
          REFRESH
        </Button>
      </PanelHeader>
      <PanelContent>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ParameterInput label="Max Speed" unit="steps/s" type="number" inputMode="numeric" value={form.max_speed} disabled={disabled} onChange={(event) => updateField("max_speed", event.target.value)} />
            <ParameterInput label="Max Accel" unit="steps/s2" type="number" inputMode="numeric" value={form.max_accel} disabled={disabled} onChange={(event) => updateField("max_accel", event.target.value)} />
            <ParameterInput label="Homing Speed" unit="steps/s" type="number" inputMode="numeric" value={form.homing_speed} disabled={disabled} onChange={(event) => updateField("homing_speed", event.target.value)} />
            <ParameterInput label="Test Speed" unit="steps/s" type="number" inputMode="numeric" value={form.test_speed} disabled={disabled} onChange={(event) => updateField("test_speed", event.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={disabled} className={`min-w-36 ${PARAMETER_RADIUS_CLASS}`}>
              APPLY MOTOR
            </Button>
          </div>
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

  // The firmware logs one sample per second, so the sample index maps directly
  // to elapsed seconds. Using the index keeps the X axis readable instead of
  // plotting raw millisecond timestamps (e.g. 3349730).
  return raw.times.map((_timestamp, index) => ({
    timestamp: index,
    depth: raw.depth_m?.[index] ?? raw.depth?.[index],
    pressure: raw.pressure_kpa?.[index] ?? raw.pressure?.[index],
    syringe: raw.syringe_u?.[index] ?? raw.syringe_position_u?.[index],
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
          title="Depth / Pressure / Syringe"
          description={data?.error_message ?? "Depth in m, pressure in kPa, syringe position as normalized u."}
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
    applyRuntimeBalanceConfig,
    applyRuntimeMotorConfig,
    applyRuntimePidConfig,
    applyRuntimeProfile,
    applySyringe,
    applyPidHold,
    commands,
    fetchProfileData,
    refreshRuntimeBalanceConfig,
    refreshRuntimeMotorConfig,
    refreshRuntimePidConfig,
    refreshRuntimeProfile,
    isBusy,
    isFetchingProfile,
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

        <Tabs defaultValue="mission" className="min-h-0 flex-1 overflow-hidden">
          <TabsList className="shrink-0">
            <TabsTrigger value="mission">Mission</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="mission" className="min-h-0 overflow-hidden">
            <section className="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_380px]">
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
                  onSendTestSteps={sendTestSteps}
                />

                <FloatSyringePanel
                  disabled={isBusy}
                  onApply={applySyringe}
                />

                <FloatPidHoldPanel
                  disabled={isBusy}
                  onApply={applyPidHold}
                />
              </aside>
            </section>
          </TabsContent>

          <TabsContent value="settings" className="min-h-0 overflow-auto">
            <section className="grid gap-3 pr-1">
              <FloatRuntimeProfilePanel
                key={state.runtimeProfile ? JSON.stringify(state.runtimeProfile) : "default-profile"}
                profile={state.runtimeProfile}
                statusText={state.runtimeProfileStatus}
                disabled={isBusy}
                onApply={applyRuntimeProfile}
                onRefresh={() => {
                  void refreshRuntimeProfile()
                }}
              />
              <FloatPidConfigPanel
                key={state.runtimePidConfig ? JSON.stringify(state.runtimePidConfig) : "default-pid"}
                config={state.runtimePidConfig}
                statusText={state.runtimePidConfigStatus}
                disabled={isBusy}
                onApply={applyRuntimePidConfig}
                onRefresh={() => {
                  void refreshRuntimePidConfig()
                }}
              />
              <FloatBalanceConfigPanel
                key={state.runtimeBalanceConfig ? JSON.stringify(state.runtimeBalanceConfig) : "default-balance"}
                config={state.runtimeBalanceConfig}
                statusText={state.runtimeBalanceConfigStatus}
                disabled={isBusy}
                onApply={applyRuntimeBalanceConfig}
                onRefresh={() => {
                  void refreshRuntimeBalanceConfig()
                }}
              />
              <FloatMotorConfigPanel
                key={state.runtimeMotorConfig ? JSON.stringify(state.runtimeMotorConfig) : "default-motor"}
                config={state.runtimeMotorConfig}
                statusText={state.runtimeMotorConfigStatus}
                disabled={isBusy}
                onApply={applyRuntimeMotorConfig}
                onRefresh={() => {
                  void refreshRuntimeMotorConfig()
                }}
              />
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
