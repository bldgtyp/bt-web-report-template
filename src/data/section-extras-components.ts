import HeatIndexChart from "../charts/HeatIndexChart.astro";
import SetTemperatureChart from "../charts/SetTemperatureChart.astro";
import type { SectionExtrasRegistry } from "./section-extras-registry";

export const sectionExtrasRegistry: SectionExtrasRegistry = {
  HeatIndexChart: { component: HeatIndexChart, slot: "Children" },
  SetTemperatureChart: { component: SetTemperatureChart, slot: "Children" },
};
