import { defineMiddleware } from "astro:middleware";

import { loadTemplateReportData, type TemplateReportData } from "../data/report";

let cached: TemplateReportData | null = null;

async function getReport(): Promise<TemplateReportData> {
  if (cached === null) {
    cached = await loadTemplateReportData();
  }
  return cached;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const report = await getReport();
  context.locals.project = report.project;
  return next();
});
