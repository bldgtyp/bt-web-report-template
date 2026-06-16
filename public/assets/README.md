# Project assets

Put project-specific renders, photographs, diagrams, and exported graphics here.
Keep source/model files outside the web repo unless the report needs to publish
them.

Splash page hero slot:

- `cover/hero.optimized.png` is the web-optimized display image.
- `cover/hero.full.png` is the high-resolution modal image.
- `content/summary.mdx` controls the displayed path, modal path, alt text, and
  caption.

Model geometry slot:

- `model-geometry/iso-dimensions.optimized.png` is the web-optimized display image.
- `model-geometry/iso-dimensions.full.png` is the high-resolution modal image.
- The energy-model page renders the display image and opens the high-resolution
  image in the report modal.

Windows image slots:

- `windows/site-shading/sun-path-plan.optimized.png` and
  `windows/site-shading/sun-path-iso.optimized.png` are the display images for the site
  shading section.
- `windows/site-shading/sun-path-plan.full.png` and
  `windows/site-shading/sun-path-iso.full.png` are the high-resolution modal
  images.
- `windows/radiation/winter.optimized.png` and `windows/radiation/summer.optimized.png` are the
  display images for the seasonal radiation sections.
- `windows/radiation/winter.full.png` and
  `windows/radiation/summer.full.png` are the high-resolution modal images.
- `content/windows/*.mdx` controls the displayed paths, modal paths, alt text,
  and captions.

Mechanical plan slots:

- `mechanical/plans/<slug>.optimized.png` is the web-display image for a Rhino-exported
  mechanical plan PDF.
- `mechanical/plans/<slug>.full.png` is the high-resolution image generated from the PDF.
- `mechanical/plans/<slug>.pdf` is the optional linked source drawing.
- `content/mechanical/plans/<slug>.mdx` controls the title, sort order, display
  image path, and linked PDF path.
