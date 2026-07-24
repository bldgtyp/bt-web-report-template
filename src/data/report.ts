import { loadReportData, type ReportData } from "./report-loader";

import { loadProjectConfig, manifestProject, projectDataDir, type ProjectConfig } from "./project";

export interface TemplateReportData extends ReportData {
  project: ProjectConfig;
}

export async function loadTemplateReportData(root = process.cwd()): Promise<TemplateReportData> {
  const project = await loadProjectConfig(root);
  const report = await loadReportData(projectDataDir(project, root));
  if (
    project.recommended_variant_id &&
    report.variantOrder.length > 0 &&
    !report.variantOrder.some((variant) => variant.id === project.recommended_variant_id)
  ) {
    const availableIds = report.variantOrder.map((variant) => variant.id).join(", ");
    throw new Error(
      `project.yaml recommended_variant_id '${project.recommended_variant_id}' does not match a scraped variant ID. Available IDs: ${availableIds}.`,
    );
  }
  const recommendedVariantId = project.recommended_variant_id ?? report.manifest.recommended_variant_id;
  const variantOrder = report.variantOrder.map((variant) => ({
    ...variant,
    recommended: recommendedVariantId ? variant.id === recommendedVariantId : Boolean(variant.recommended),
  }));

  return {
    ...report,
    variantOrder,
    project,
    manifest: {
      ...report.manifest,
      recommended_variant_id: recommendedVariantId ?? report.manifest.recommended_variant_id,
      project: {
        ...report.manifest.project,
        ...manifestProject(project),
      },
    },
  };
}
