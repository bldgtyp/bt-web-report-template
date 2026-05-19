import { defineConfig, type Collection, type TinaField } from "tinacms";

const lockedSectionActions = {
  create: false,
  delete: false,
  createNestedFolder: false,
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
    type: "string",
    name: "notes",
    label: "Notes",
    list: true,
    ui: {
      component: "textarea",
    },
  },
  {
    type: "rich-text",
    name: "body",
    label: "Additional content",
    isBody: true,
  },
];

function fixedMdxSection(label: string, name: string, path: string, include: string): Collection {
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
    fields: reportSectionFields,
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
      fixedMdxSection("Executive summary", "summary", "content", "summary"),
      fixedMdxSection("Energy model", "energy_model", "content", "energy-model"),
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
      fixedMdxSection("Envelope overview", "envelope_overview", "content/envelope", "overview"),
      fixedMdxSection("Recommended assemblies intro", "assemblies", "content/envelope", "assemblies"),
      fixedMdxSection("Building airtightness intro", "airtightness", "content/envelope", "airtightness"),
      fixedMdxSection(
        "Building airtightness notes",
        "airtightness_notes",
        "content/envelope",
        "airtightness-notes",
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
        },
        fields: assemblyFields,
      },
      fixedMdxSection("Windows", "windows", "content", "windows"),
      fixedMdxSection("Mechanical", "mechanical", "content", "mechanical"),
      fixedMdxSection("Appendix", "appendix", "content", "appendix"),
    ],
  },
});
