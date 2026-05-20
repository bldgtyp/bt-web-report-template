import { defineConfig, type Collection, type Template, type TinaField } from "tinacms";

const lockedSectionActions = {
  create: false,
  delete: false,
  createNestedFolder: false,
};

// Options for the <Var> rich-text shortcode. Keys mirror dot-paths into
// project.yaml (validated by bt-web-report-schemas). Adding a new field to
// the Pydantic schema also requires adding it here so editors can pick it.
// TODO: generate this list from @bldgtyp/web-report-schemas/project.schema.json
// so the two can never drift.
const VAR_KEY_OPTIONS: { value: string; label: string }[] = [
  // Top-level project facts
  { value: "client_name", label: "Client name" },
  { value: "building_name", label: "Building name" },
  { value: "project_title", label: "Project title" },
  { value: "phase", label: "Phase" },
  { value: "report_date", label: "Report date" },
  { value: "prepared_by", label: "Prepared by" },
  { value: "contact_email", label: "Contact email" },
  { value: "target_standard", label: "Target standard" },
  { value: "certification_program", label: "Certification program" },
  { value: "certification_path", label: "Certification path" },
  // Building
  { value: "building.address", label: "Building > Address" },
  { value: "building.city", label: "Building > City" },
  { value: "building.state", label: "Building > State" },
  { value: "building.climate_zone", label: "Building > Climate zone" },
  { value: "building.building_type", label: "Building > Building type" },
  // Narrative > Certification
  { value: "narrative.certification.target", label: "Certification > Target" },
  { value: "narrative.certification.ph_ach_limit", label: "Certification > PH ACH50 limit" },
  { value: "narrative.certification.phi_lcd_limit", label: "Certification > PHI latent cooling demand limit" },
  { value: "narrative.certification.enph_hd_limit", label: "Certification > EnerPHit heating demand limit" },
  { value: "narrative.certification.enph_per_limit", label: "Certification > EnerPHit PER limit" },
  { value: "narrative.certification.enph_bg_limit", label: "Certification > EnerPHit below-grade R-value limit" },
  { value: "narrative.certification.enph_ag_ext_limit", label: "Certification > EnerPHit above-grade ext. R-value limit" },
  { value: "narrative.certification.enph_ag_int_limit", label: "Certification > EnerPHit above-grade int. R-value limit" },
  { value: "narrative.certification.enph_uw_limit", label: "Certification > EnerPHit window U-installed limit" },
  { value: "narrative.certification.phius_hd_limit", label: "Certification > Phius heating demand limit" },
  { value: "narrative.certification.phius_cd_limit", label: "Certification > Phius cooling demand limit" },
  { value: "narrative.certification.phius_hl_limit", label: "Certification > Phius heating load limit" },
  { value: "narrative.certification.phius_cl_limit", label: "Certification > Phius cooling load limit" },
  { value: "narrative.certification.phius_nse_limit", label: "Certification > Phius net source energy limit" },
  { value: "narrative.certification.phius_cfm50_limit", label: "Certification > Phius CFM50 limit" },
  // Narrative > Climate
  { value: "narrative.climate.weather_station_name", label: "Climate > Weather station name" },
  { value: "narrative.climate.weather_station_url", label: "Climate > Weather station URL" },
  { value: "narrative.climate.state_name", label: "Climate > State name" },
  { value: "narrative.climate.state_name_abbreviation", label: "Climate > State abbreviation" },
  { value: "narrative.climate.ashrae_location_name", label: "Climate > ASHRAE location" },
  { value: "narrative.climate.ashrae_design_temps", label: "Climate > ASHRAE design temps" },
  // Narrative > Energy code
  { value: "narrative.energy_code.name", label: "Energy code > Name" },
  { value: "narrative.energy_code.zone", label: "Energy code > Zone" },
  { value: "narrative.energy_code.link", label: "Energy code > Link" },
  { value: "narrative.energy_code.u_val_link", label: "Energy code > U-value link" },
  { value: "narrative.energy_code.ach_link", label: "Energy code > ACH link" },
  { value: "narrative.energy_code.ach_limit", label: "Energy code > ACH limit" },
  { value: "narrative.energy_code.window_min_u_value", label: "Energy code > Window min U-value" },
  // Narrative > CO2
  { value: "narrative.co2.subregion_name", label: "CO2 > Subregion name" },
  { value: "narrative.co2.occupancy", label: "CO2 > Occupancy" },
  { value: "narrative.co2.target_tons", label: "CO2 > Target tons" },
  // Narrative > Windows
  { value: "narrative.windows.ph_window_u_value", label: "Windows > PH window U-value" },
  { value: "narrative.windows.ph_window_r_value", label: "Windows > PH window R-value" },
  // Narrative > Mechanical / ERV
  { value: "narrative.mechanical.erv.manufacturer_name", label: "ERV > Manufacturer" },
  { value: "narrative.mechanical.erv.type_name", label: "ERV > Type" },
  { value: "narrative.mechanical.erv.link", label: "ERV > Link" },
];

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
      fixedMdxSection("Window thermal comfort", "window_thermal_comfort", "content/windows", "window-thermal-comfort"),
      fixedMdxSection("Site shading", "site_shading", "content/windows", "site-shading", siteShadingFields),
      fixedMdxSection("Winter radiation", "winter_radiation", "content/windows", "winter-radiation", radiationFields),
      fixedMdxSection("Summer radiation", "summer_radiation", "content/windows", "summer-radiation", radiationFields),
      fixedMdxSection("Mechanical", "mechanical", "content", "mechanical"),
      fixedMdxSection("Appendix", "appendix", "content", "appendix"),
    ],
  },
});
