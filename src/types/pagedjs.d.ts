// Minimal ambient module declaration for pagedjs. The package ships JS only;
// we only consume the Previewer class from paged-init.ts, so a narrow shape
// is sufficient. Expand if other entry points are needed.

declare module "pagedjs" {
  export interface Previewer {
    preview(
      content?: Element,
      stylesheets?: Array<string | { url?: string; css?: string }>,
      renderTo?: Element,
    ): Promise<{ total?: number }>;
  }

  export const Previewer: { new (): Previewer };

  export class Handler {
    constructor();
    afterPageLayout?(
      pageElement: HTMLElement,
      page: unknown,
      breakToken: unknown,
      chunker: { source: HTMLElement },
    ): void;
    beforeParsed?(content: HTMLElement): void;
    afterParsed?(content: HTMLElement): void;
  }

  export function registerHandlers(...handlers: Array<typeof Handler>): void;
}
