import { listVarKeyOptions } from "@bldgtyp/web-report-schemas";
import { defineConfig, type Collection, type Template, type TinaField } from "tinacms";

const lockedSectionActions = {
  create: false,
  delete: false,
  createNestedFolder: false,
};

// <Var> dropdown options are derived from the generated JSON Schema so a
// field added to the Pydantic Project model automatically becomes available
// to editors. "Narrative" is flattened out of labels because editors don't
// distinguish narrative.* from top-level project.* — both are just project
// values to them.
const VAR_KEY_OPTIONS = listVarKeyOptions({ stripLabelSegments: ["Narrative"] });

const varTemplate: Template = {
  name: "Var",
  label: "Variable",
  fields: [
    {
      type: "string",
      name: "k",
      label: "Variable",
      required: true,
      options: VAR_KEY_OPTIONS,
    },
  ],
};

const reportSectionFields: TinaField[] = [
  {
    type: "string",
    name: "kicker",
    label: "Section number",
    required: true,
  },
  {
    type: "string",
    name: "title",
    label: "Section title",
    required: true,
  },
  {
    type: "string",
    name: "dek",
    label: "Editorial heading",
    required: true,
    ui: {
      component: "textarea",
    },
  },
  {
    type: "string",
    name: "callout_label",
    label: "Callout label",
  },
  {
    type: "string",
    name: "callout_body",
    label: "Callout body",
    ui: {
      component: "textarea",
    },
  },
  {
    type: "rich-text",
    name: "body",
    label: "Section content",
    isBody: true,
    templates: [varTemplate],
  },
];

const summaryFields: TinaField[] = [
  ...reportSectionFields,
  {
    type: "image",
    name: "hero_image",
    label: "Hero display image",
    required: true,
  },
  {
    type: "image",
    name: "hero_image_full",
    label: "Hero high-resolution image",
    required: true,
  },
  {
    type: "string",
    name: "hero_alt",
    label: "Hero alt text",
    required: true,
    ui: {
      component: "textarea",
    },
  },
  {
    type: "string",
    name: "hero_caption",
    label: "Hero caption",
  },
];

const siteShadingFields: TinaField[] = [
  ...reportSectionFields,
  {
    type: "image",
    name: "sun_path_plan_image",
    label: "Sun path plan display image",
    required: true,
  },
  {
    type: "image",
    name: "sun_path_plan_image_full",
    label: "Sun path plan high-resolution image",
    required: true,
  },
  {
    type: "string",
    name: "sun_path_plan_alt",
    label: "Sun path plan alt text",
    required: true,
    ui: {
      component: "textarea",
    },
  },
  {
    type: "string",
    name: "sun_path_plan_caption",
    label: "Sun path plan caption",
  },
  {
    type: "image",
    name: "sun_path_iso_image",
    label: "Sun path axonometric display image",
    required: true,
  },
  {
    type: "image",
    name: "sun_path_iso_image_full",
    label: "Sun path axonometric high-resolution image",
    required: true,
  },
  {
    type: "string",
    name: "sun_path_iso_alt",
    label: "Sun path axonometric alt text",
    required: true,
    ui: {
      component: "textarea",
    },
  },
  {
    type: "string",
    name: "sun_path_iso_caption",
    label: "Sun path axonometric caption",
  },
];

const radiationFields: TinaField[] = [
  ...reportSectionFields,
  {
    type: "image",
    name: "radiation_image",
    label: "Radiation display image",
    required: true,
  },
  {
    type: "image",
    name: "radiation_image_full",
    label: "Radiation high-resolution image",
    required: true,
  },
  {
    type: "string",
    name: "radiation_alt",
    label: "Radiation image alt text",
    required: true,
    ui: {
      component: "textarea",
    },
  },
  {
    type: "string",
    name: "radiation_caption",
    label: "Radiation image caption",
  },
];

const assemblyFields: TinaField[] = [
  {
    type: "string",
    name: "title",
    label: "Assembly name",
    required: true,
  },
  {
    type: "number",
    name: "order",
    label: "Sort order",
    required: true,
  },
  {
    type: "image",
    name: "image",
    label: "Thumbnail image",
    required: true,
  },
  {
    type: "image",
    name: "pdf",
    label: "Linked PDF",
    required: true,
  },
  {
    type: "rich-text",
    name: "body",
    label: "Additional content",
    isBody: true,
    templates: [varTemplate],
  },
];

const mechanicalPlanFields: TinaField[] = [
  {
    type: "string",
    name: "title",
    label: "Plan title",
    required: true,
  },
  {
    type: "number",
    name: "order",
    label: "Sort order",
    required: true,
  },
  {
    type: "image",
    name: "image",
    label: "Display image",
    required: true,
  },
  {
    type: "image",
    name: "pdf",
    label: "Linked PDF",
    required: true,
  },
  {
    type: "rich-text",
    name: "body",
    label: "Additional content",
    isBody: true,
    templates: [varTemplate],
  },
];

function fixedMdxSection(
  label: string,
  name: string,
  path: string,
  include: string,
  fields: TinaField[] = reportSectionFields,
): Collection {
  return {
    label,
    name,
    path,
    format: "mdx" as const,
    match: {
      include,
    },
    ui: {
      allowedActions: lockedSectionActions,
    },
    fields,
  };
}

export default defineConfig({
  branch: process.env.HEAD || process.env.TINA_PUBLIC_BRANCH || "main",
  localContentPath: process.env.BTWR_TINA_CONTENT_ROOT,
  build: {
    publicFolder: "public",
    outputFolder: "admin",
  },
  media: {
    tina: {
      publicFolder: "public",
      mediaRoot: "assets",
    },
  },
  schema: {
    collections: [
      fixedMdxSection("Executive summary", "summary", "content", "summary", summaryFields),
      fixedMdxSection("Model geometry", "energy_model_geometry", "content/energy-model", "model-geometry"),
      fixedMdxSection("Model variants", "energy_model_variants", "content/energy-model", "model-variants"),
      fixedMdxSection("Site energy", "energy_model_site_energy", "content/energy-model", "site-energy"),
      fixedMdxSection("CO2 emissions", "energy_model_co2_emissions", "content/energy-model", "co2-emissions"),
      fixedMdxSection(
        "Passive House thresholds",
        "energy_model_passive_house_thresholds",
        "content/energy-model",
        "passive-house-thresholds",
      ),
      fixedMdxSection("Climate data", "energy_model_climate_data", "content/energy-model", "climate-data"),
      fixedMdxSection(
        "Passive House certifications",
        "energy_model_passive_house_certifications",
        "content/energy-model",
        "passive-house-certifications",
      ),
      fixedMdxSection("Recommended assemblies intro", "assemblies", "content/envelope", "assemblies"),
      fixedMdxSection("Building airtightness intro", "airtightness", "content/envelope", "airtightness"),
      fixedMdxSection(
        "Masonry Rowhouse Air-Sealing Primer",
        "masonry_rowhouse_airsealing_primer",
        "content/envelope",
        "masonry-rowhouse-airsealing-primer",
      ),
      fixedMdxSection("AeroBarrier", "aerobarrier", "content/envelope", "aerobarrier"),
      {
        label: "Recommended assemblies",
        name: "recommended_assemblies",
        path: "content/envelope/assemblies",
        format: "mdx" as const,
        ui: {
          allowedActions: {
            create: true,
            delete: true,
            createNestedFolder: false,
          },
          beforeSubmit: async ({ values }) => {
            const bodyFirstValues = { ...values };
            delete bodyFirstValues.notes;
            return bodyFirstValues;
          },
        },
        fields: assemblyFields,
      },
      fixedMdxSection("Window thermal comfort", "window_thermal_comfort", "content/windows", "window-thermal-comfort"),
      fixedMdxSection("Site shading", "site_shading", "content/windows", "site-shading", siteShadingFields),
      fixedMdxSection("Winter radiation", "winter_radiation", "content/windows", "winter-radiation", radiationFields),
      fixedMdxSection("Summer radiation", "summer_radiation", "content/windows", "summer-radiation", radiationFields),
      fixedMdxSection(
        "Fresh-air ventilation",
        "mechanical_fresh_air_ventilation",
        "content/mechanical",
        "fresh-air-ventilation",
      ),
      fixedMdxSection("Fresh-air flow rates", "mechanical_fresh_air_flow_rates", "content/mechanical", "fresh-air-flow-rates"),
      fixedMdxSection(
        "Ventilation system balancing",
        "mechanical_ventilation_system_balancing",
        "content/mechanical",
        "ventilation-system-balancing",
      ),
      fixedMdxSection(
        "Passive House ventilation requirements",
        "mechanical_passive_house_ventilation_requirements",
        "content/mechanical",
        "passive-house-ventilation-requirements",
      ),
      fixedMdxSection("Appliances and venting", "mechanical_appliances_and_venting", "content/mechanical", "appliances-and-venting"),
      fixedMdxSection("Building monitoring", "mechanical_building_monitoring", "content/mechanical", "building-monitoring"),
      {
        label: "Mechanical plans",
        name: "mechanical_plans",
        path: "content/mechanical/plans",
        format: "mdx" as const,
        ui: {
          allowedActions: {
            create: true,
            delete: true,
            createNestedFolder: false,
          },
        },
        fields: mechanicalPlanFields,
      },
      fixedMdxSection("Appendix", "appendix", "content", "appendix"),
    ],
  },
});
