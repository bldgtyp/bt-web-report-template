import * as Plot from "@observablehq/plot";
import { createRequire } from "node:module";

import type { ReportVariant } from "../data/manifest";
import { variantColor } from "../data/rows";

type PlotOptions = NonNullable<Parameters<typeof Plot.plot>[0]>;

const DEFAULT_MARGIN = { top: 24, right: 24, bottom: 64, left: 72 };
const require = createRequire(import.meta.url);

export interface PlotSeriesDatum {
  label: string;
  value: number;
  series?: string;
  variantId?: string;
  units?: string;
}

const INTERACTIVE_MARK_CLASS = "btwr-chart-mark";

export async function renderPlotSvg(options: PlotOptions): Promise<string> {
  const { JSDOM } = require("jsdom") as typeof import("jsdom");
  const { document } = new JSDOM("<!doctype html>").window;
  const svg = Plot.plot({
    document,
    width: 880,
    height: 360,
    marginTop: DEFAULT_MARGIN.top,
    marginRight: DEFAULT_MARGIN.right,
    marginBottom: DEFAULT_MARGIN.bottom,
    marginLeft: DEFAULT_MARGIN.left,
    style: {
      background: "transparent",
      color: "var(--btwr-color-text)",
      fontFamily: "var(--btwr-font-label)",
      fontSize: "12px",
    },
    grid: true,
    ...options,
  });

  return svg.outerHTML;
}

export function variantPalette(variants: ReportVariant[]): string[] {
  return variants.map((_, index) => variantColor(index));
}

export function variantDomain(variants: ReportVariant[]): string[] {
  return variants.map((variant) => variant.name);
}

function formatChartNumber(value: number): string {
  const absValue = Math.abs(value);
  const maximumFractionDigits = absValue >= 100 ? 0 : absValue >= 10 ? 1 : 2;
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function tooltipText(datum: PlotSeriesDatum, fallbackUnits?: string): string {
  const units = datum.units ?? fallbackUnits ?? "";
  const formattedValue = `${formatChartNumber(datum.value)}${units ? ` ${units}` : ""}`;
  return datum.series ? `${datum.label}\n${datum.series}: ${formattedValue}` : `${datum.label}: ${formattedValue}`;
}

export async function barChart(
  data: PlotSeriesDatum[],
  options: { yLabel: string; colorDomain?: string[]; colorRange?: string[]; xDomain?: string[]; units?: string },
): Promise<string> {
  const xDomain = options.xDomain ?? [...new Set(data.map((datum) => datum.label))];
  return renderPlotSvg({
    y: {
      label: options.yLabel,
      grid: true,
    },
    x: {
      label: null,
      domain: xDomain,
      tickRotate: -28,
    },
    color: {
      legend: false,
      domain: options.colorDomain,
      range: options.colorRange,
    },
    marks: [
      Plot.ruleY([0]),
      Plot.barY(data, {
        x: "label",
        y: "value",
        fill: "series",
        insetLeft: 3,
        insetRight: 3,
        stroke: "rgba(255, 255, 255, 0.86)",
        strokeWidth: 1,
        className: `${INTERACTIVE_MARK_CLASS} btwr-chart-mark--bar`,
        ariaLabel: (datum: PlotSeriesDatum) => tooltipText(datum, options.units).replace("\n", ", "),
      }),
    ],
  });
}

export function lineChart(
  data: PlotSeriesDatum[],
  options: { yLabel: string; colorDomain?: string[]; colorRange?: string[]; xDomain?: string[]; units?: string },
): Promise<string> {
  return renderPlotSvg({
    y: {
      label: options.yLabel,
      grid: true,
    },
    x: {
      label: null,
      domain: options.xDomain,
    },
    color: {
      legend: false,
      domain: options.colorDomain,
      range: options.colorRange,
    },
    marks: [
      Plot.ruleY([0]),
      Plot.lineY(data, {
        x: "label",
        y: "value",
        stroke: "series",
        strokeWidth: 2.5,
      }),
      Plot.dot(data, {
        x: "label",
        y: "value",
        fill: "series",
        r: 3,
        className: `${INTERACTIVE_MARK_CLASS} btwr-chart-mark--dot`,
        ariaLabel: (datum: PlotSeriesDatum) => tooltipText(datum, options.units).replace("\n", ", "),
      }),
    ],
  });
}
