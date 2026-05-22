const FULL_URL = /^(?:https?:)?\/\//i;
const NEW_TAB_REL_VALUES = ["noopener", "noreferrer"];

export default function remarkFullUrlLinksNewTab() {
  return function transformer(tree) {
    rewriteLinks(tree);
  };
}

export function isFullUrl(value) {
  return typeof value === "string" && FULL_URL.test(value);
}

export function newTabRel(value) {
  const values = new Set(
    String(value ?? "")
      .split(/\s+/)
      .filter(Boolean),
  );

  for (const rel of NEW_TAB_REL_VALUES) {
    values.add(rel);
  }

  return Array.from(values).join(" ");
}

function rewriteLinks(node) {
  if (!node) {
    return;
  }

  if (node.type === "link" && isFullUrl(node.url)) {
    node.data = node.data ?? {};
    node.data.hProperties = {
      ...node.data.hProperties,
      target: "_blank",
      rel: newTabRel(node.data.hProperties?.rel),
    };
  }

  if ((node.type === "mdxJsxTextElement" || node.type === "mdxJsxFlowElement") && node.name === "a") {
    rewriteMdxAnchor(node);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      rewriteLinks(child);
    }
  }
}

function rewriteMdxAnchor(node) {
  const href = getMdxAttribute(node, "href");
  if (!isFullUrl(href?.value)) {
    return;
  }

  setMdxAttribute(node, "target", "_blank");
  setMdxAttribute(node, "rel", newTabRel(getMdxAttribute(node, "rel")?.value));
}

function getMdxAttribute(node, name) {
  return node.attributes?.find((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name);
}

function setMdxAttribute(node, name, value) {
  const existing = getMdxAttribute(node, name);
  if (existing) {
    existing.value = value;
    return;
  }

  node.attributes = node.attributes ?? [];
  node.attributes.push({ type: "mdxJsxAttribute", name, value });
}
