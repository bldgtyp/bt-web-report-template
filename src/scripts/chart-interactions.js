(() => {
  const stateAttribute = "data-btwr-chart-interactions";
  if (document.documentElement.hasAttribute(stateAttribute)) {
    return;
  }
  document.documentElement.setAttribute(stateAttribute, "ready");

  const markSelector = ".btwr-chart-mark";
  const chartFrameSelector = ".btwr-chart-frame[data-chart]";
  const expandButtonSelector = ".btwr-chart-expand";
  const fileDownloadSelector = "[data-download-filename]";
  const imageModalSelector = [
    ".btwr-hero__figure img",
    ".btwr-report-main .btwr-section-hero img",
    ".btwr-report-main .btwr-geometry-figure img",
    ".btwr-report-main .btwr-window-image-slot img",
    ".btwr-report-main .btwr-assembly-card__image img",
    ".btwr-report-main .btwr-prose img",
  ].join(", ");
  let activeMark = null;
  let tooltip = null;
  let modal = null;
  let modalContent = null;
  let closeButton = null;
  let returnFocusTo = null;

  function ensureTooltip() {
    const host = tooltipHost();
    if (tooltip) {
      if (tooltip.parentElement !== host) {
        host.appendChild(tooltip);
      }
      return tooltip;
    }

    tooltip = document.createElement("div");
    tooltip.className = "btwr-chart-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    host.appendChild(tooltip);
    return tooltip;
  }

  function tooltipHost() {
    return modal?.open ? modal : document.body;
  }

  function findMark(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    const markGroup = target.closest(markSelector);
    if (!markGroup) {
      return null;
    }

    let candidate = target;
    while (candidate && candidate !== markGroup.parentElement) {
      normalizeMark(candidate);
      if (tooltipText(candidate)) {
        return candidate;
      }
      if (candidate === markGroup) {
        break;
      }
      candidate = candidate.parentElement;
    }

    return tooltipText(markGroup) ? markGroup : null;
  }

  function normalizeMark(mark) {
    const titleElements = Array.from(mark.children).filter((child) => child.tagName.toLowerCase() === "title");
    const nativeTitle = mark.getAttribute("title") || titleElements[0]?.textContent || "";
    if (!nativeTitle.trim()) {
      return;
    }

    if (!mark.getAttribute("data-btwr-tooltip")) {
      mark.setAttribute("data-btwr-tooltip", nativeTitle.trim());
    }
    if (!mark.getAttribute("aria-label")) {
      mark.setAttribute("aria-label", nativeTitle.trim().replace("\n", ", "));
    }
    mark.removeAttribute("title");
    titleElements.forEach((titleElement) => titleElement.remove());
  }

  function tooltipText(mark) {
    return (
      mark.getAttribute("data-btwr-tooltip") ||
      mark.getAttribute("aria-label") ||
      ""
    ).trim();
  }

  function positionTooltip(event) {
    const tip = ensureTooltip();
    const offset = 14;
    const margin = 8;
    const rect = tip.getBoundingClientRect();
    let left = event.clientX + offset;
    let top = event.clientY + offset;

    if (left + rect.width > window.innerWidth - margin) {
      left = event.clientX - rect.width - offset;
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = event.clientY - rect.height - offset;
    }

    tip.style.left = `${Math.max(margin, left)}px`;
    tip.style.top = `${Math.max(margin, top)}px`;
  }

  function showTooltip(mark, event) {
    const text = tooltipText(mark);
    if (!text) {
      return;
    }

    if (activeMark && activeMark !== mark) {
      activeMark.classList.remove("is-hovered");
    }

    activeMark = mark;
    activeMark.classList.add("is-hovered");

    const tip = ensureTooltip();
    tip.textContent = text;
    tip.hidden = false;
    positionTooltip(event);
  }

  function hideTooltip(mark = activeMark) {
    if (mark) {
      mark.classList.remove("is-hovered");
    }
    if (mark === activeMark) {
      activeMark = null;
    }
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.textContent = "";
    }
  }

  function expandIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 3H3v5" />
        <path d="M3 3l7 7" />
        <path d="M16 3h5v5" />
        <path d="M21 3l-7 7" />
        <path d="M8 21H3v-5" />
        <path d="M3 21l7-7" />
        <path d="M16 21h5v-5" />
        <path d="M21 21l-7-7" />
      </svg>
    `;
  }

  function ensureModal() {
    if (modal) {
      return modal;
    }

    modal = document.createElement("dialog");
    modal.className = "btwr-chart-modal btwr-media-modal";
    modal.setAttribute("aria-label", "Expanded report media");
    modal.innerHTML = `
      <div class="btwr-chart-modal__panel">
        <button class="btwr-chart-modal__close" type="button" aria-label="Close expanded media">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
        <div class="btwr-chart-modal__content"></div>
      </div>
    `;

    modalContent = modal.querySelector(".btwr-chart-modal__content");
    closeButton = modal.querySelector(".btwr-chart-modal__close");
    closeButton.addEventListener("click", closeExpandedMedia);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeExpandedMedia();
      }
    });
    modal.addEventListener("close", () => {
      document.body.classList.remove("btwr-chart-modal-open");
      if (modalContent) {
        modalContent.replaceChildren();
      }
      if (returnFocusTo instanceof HTMLElement && document.contains(returnFocusTo)) {
        returnFocusTo.focus();
      }
      returnFocusTo = null;
    });

    document.body.appendChild(modal);
    return modal;
  }

  function closeExpandedMedia() {
    if (!modal) {
      return;
    }

    if (typeof modal.close === "function" && modal.open) {
      modal.close();
      return;
    }

    modal.removeAttribute("open");
    modal.dispatchEvent(new Event("close"));
  }

  function openExpandedChart(frame, trigger) {
    const activeModal = ensureModal();
    activeModal.setAttribute("aria-label", "Expanded chart");
    hideTooltip();

    const clone = frame.cloneNode(true);
    clone.querySelectorAll(expandButtonSelector).forEach((button) => button.remove());
    clone.removeAttribute("id");
    clone.setAttribute("data-chart-expanded", "true");
    modalContent.replaceChildren(clone);
    returnFocusTo = trigger;
    document.body.classList.add("btwr-chart-modal-open");

    if (typeof activeModal.showModal === "function") {
      activeModal.showModal();
    } else {
      activeModal.setAttribute("open", "");
    }
    closeButton.focus();
  }

  function isImageHref(value) {
    if (!value) {
      return false;
    }

    try {
      const url = new URL(value, window.location.href);
      return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function closestImageLink(image) {
    const link = image.closest("a");
    return link?.contains(image) ? link : null;
  }

  function imageModalSource(image, link) {
    const explicitSource =
      link?.getAttribute("data-btwr-full-src") ||
      image.getAttribute("data-btwr-full-src") ||
      image.getAttribute("data-btwr-modal-src");
    if (explicitSource) {
      return explicitSource;
    }

    const linkedHref = link?.getAttribute("href");
    if (isImageHref(linkedHref)) {
      return linkedHref;
    }

    return image.currentSrc || image.getAttribute("src") || "";
  }

  function imageCaption(image, link) {
    const explicitCaption = link?.getAttribute("data-btwr-caption") || image.getAttribute("data-btwr-caption");
    if (explicitCaption) {
      return explicitCaption;
    }

    const figureCaption = image.closest("figure")?.querySelector("figcaption")?.textContent?.trim();
    return figureCaption || image.getAttribute("alt") || "";
  }

  function linkedFile(image, link, modalSource) {
    const href = link?.getAttribute("href");
    if (!href || isImageHref(href) || href === modalSource) {
      return null;
    }

    return {
      href,
      label: link.getAttribute("data-btwr-linked-file-label") || `Open linked file for ${image.getAttribute("alt") || "image"}`,
    };
  }

  function findImageTrigger(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    let image = target.closest(imageModalSelector);
    let link = image instanceof HTMLImageElement ? closestImageLink(image) : null;
    if (!(image instanceof HTMLImageElement)) {
      link = target.closest("a");
      const linkedImage = link?.querySelector(imageModalSelector);
      image = linkedImage instanceof HTMLImageElement ? linkedImage : null;
    }
    if (!(image instanceof HTMLImageElement)) {
      return null;
    }

    return {
      image,
      link,
      trigger: link || image,
    };
  }

  function openExpandedImage(image, trigger, link = null) {
    const activeModal = ensureModal();
    const source = imageModalSource(image, link);
    if (!source) {
      return;
    }

    hideTooltip();
    const caption = imageCaption(image, link);
    const extraLink = linkedFile(image, link, source);
    const figure = document.createElement("figure");
    figure.className = "btwr-image-modal__figure";

    const expandedImage = document.createElement("img");
    expandedImage.src = source;
    expandedImage.alt = image.getAttribute("alt") || "";
    expandedImage.decoding = "async";
    figure.appendChild(expandedImage);

    if (caption || extraLink) {
      const footer = document.createElement("figcaption");
      if (caption) {
        const captionText = document.createElement("span");
        captionText.textContent = caption;
        footer.appendChild(captionText);
      }
      if (extraLink) {
        const fileLink = document.createElement("a");
        fileLink.href = extraLink.href;
        fileLink.target = "_blank";
        fileLink.rel = "noopener noreferrer";
        fileLink.textContent = "Open linked file";
        fileLink.setAttribute("aria-label", extraLink.label);
        footer.appendChild(fileLink);
      }
      figure.appendChild(footer);
    }

    activeModal.setAttribute("aria-label", caption ? `Expanded image: ${caption}` : "Expanded image");
    modalContent.replaceChildren(figure);
    returnFocusTo = trigger;
    document.body.classList.add("btwr-chart-modal-open");

    if (typeof activeModal.showModal === "function") {
      activeModal.showModal();
    } else {
      activeModal.setAttribute("open", "");
    }
    closeButton.focus();
  }

  function addExpandButton(frame) {
    if (frame.querySelector(expandButtonSelector)) {
      return;
    }

    const button = document.createElement("button");
    button.className = "btwr-chart-expand";
    button.type = "button";
    button.title = "Expand chart";
    button.setAttribute("aria-label", "Expand chart");
    button.innerHTML = expandIcon();
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openExpandedChart(frame, button);
    });
    frame.appendChild(button);
  }

  function decorateCharts() {
    document.querySelectorAll(chartFrameSelector).forEach(addExpandButton);
  }

  function decorateImages() {
    document.querySelectorAll(imageModalSelector).forEach((image) => {
      const link = closestImageLink(image);
      const trigger = link || image;
      trigger.classList.add("btwr-image-modal-trigger");
      if (!link) {
        trigger.setAttribute("role", "button");
        trigger.setAttribute("tabindex", "0");
        trigger.setAttribute("aria-label", `Open ${image.getAttribute("alt") || "image"} larger`);
      }
    });
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadFile(link) {
    const filename = link.getAttribute("data-download-filename") || link.getAttribute("download") || "download";
    link.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(link.href);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      saveBlob(blob, filename);
    } finally {
      link.removeAttribute("aria-busy");
    }
  }

  decorateCharts();
  decorateImages();

  document.addEventListener("click", (event) => {
    const downloadLink = event.target instanceof Element ? event.target.closest(fileDownloadSelector) : null;
    if (downloadLink instanceof HTMLAnchorElement) {
      event.preventDefault();
      downloadFile(downloadLink).catch(() => {
        window.location.assign(downloadLink.href);
      });
      return;
    }

    const match = findImageTrigger(event.target);
    if (!match) {
      return;
    }

    event.preventDefault();
    openExpandedImage(match.image, match.trigger, match.link);
  });

  document.addEventListener("pointerover", (event) => {
    const mark = findMark(event.target);
    if (!mark || mark.contains(event.relatedTarget)) {
      return;
    }
    showTooltip(mark, event);
  });

  document.addEventListener("pointermove", (event) => {
    if (activeMark) {
      positionTooltip(event);
    }
  });

  document.addEventListener("pointerout", (event) => {
    const mark = findMark(event.target);
    if (!mark || mark.contains(event.relatedTarget)) {
      return;
    }
    hideTooltip(mark);
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      const mark = findMark(event.target);
      if (mark) {
        showTooltip(mark, event);
        return;
      }
      hideTooltip();
    },
    { capture: true },
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideTooltip();
      if (modal?.open) {
        closeExpandedMedia();
      }
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const match = findImageTrigger(event.target);
    if (!match) {
      return;
    }

    event.preventDefault();
    openExpandedImage(match.image, match.trigger, match.link);
  });

  document.addEventListener("astro:page-load", () => {
    decorateCharts();
    decorateImages();
  });
})();
