import { loadReportData, type ReportData } from "@bldgtyp/web-report-kit";

import { loadProjectConfig, manifestProject, projectDataDir, type ProjectConfig } from "./project";

export interface TemplateReportData extends ReportData {
  project: ProjectConfig;
}

export async function loadTemplateReportData(root = process.cwd()): Promise<TemplateReportData> {
  const project = await loadProjectConfig(root);
  const report = await loadReportData(projectDataDir(project, root));

  return {
    ...report,
    project,
    manifest: {
      ...report.manifest,
      project: {
        ...report.manifest.project,
        ...manifestProject(project),
      },
    },
  };
}
