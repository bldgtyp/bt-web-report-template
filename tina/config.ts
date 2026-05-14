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
      fixedMdxSection("Envelope overview", "envelope_overview", "content/envelope", "overview"),
      fixedMdxSection("Assemblies", "assemblies", "content/envelope", "assemblies"),
      fixedMdxSection("Windows", "windows", "content", "windows"),
      fixedMdxSection("Mechanical", "mechanical", "content", "mechanical"),
      fixedMdxSection("Appendix", "appendix", "content", "appendix"),
    ],
  },
});
