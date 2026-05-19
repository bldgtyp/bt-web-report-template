export interface LinearAxis {
  max: number;
  ticks: number[];
  gridStops: string[];
}

const NICE_STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10] as const;

function roundTick(value: number): number {
  const absValue = Math.abs(value);
  if (absValue === 0) {
    return 0;
  }

  const precision = Math.max(0, 12 - Math.floor(Math.log10(absValue)));
  return Number(value.toPrecision(precision));
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalizedStep = rawStep / magnitude;
  const multiplier = NICE_STEP_MULTIPLIERS.find((candidate) => candidate >= normalizedStep) ?? 10;
  return multiplier * magnitude;
}

export function linearAxis(maxValue: number, targetIntervals = 5): LinearAxis {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return { max: 0, ticks: [0], gridStops: [] };
  }

  const step = niceStep(maxValue / Math.max(1, targetIntervals));
  const axisMax = roundTick(Math.ceil(maxValue / step) * step);
  const tickCount = Math.max(1, Math.round(axisMax / step));
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => roundTick(index * step));
  const gridStops = ticks.slice(1, -1).map((tick) => `${(tick / axisMax) * 100}%`);

  return { max: axisMax, ticks, gridStops };
}

export function axisGridBackground(gridStops: string[]): string {
  if (gridStops.length === 0) {
    return "none";
  }

  return gridStops
    .map(
      (stop) =>
        `linear-gradient(to right, transparent calc(${stop} - 0.5px), rgba(17, 17, 17, 0.08) calc(${stop} - 0.5px), rgba(17, 17, 17, 0.08) calc(${stop} + 0.5px), transparent calc(${stop} + 0.5px))`,
    )
    .join(", ");
}
