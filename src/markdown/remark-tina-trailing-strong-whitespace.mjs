const TINA_TRAILING_STRONG_WHITESPACE = /\*\*((?:(?!\*\*).)*?\S)([ \t]+)\*\*/g;

export default function remarkTinaTrailingStrongWhitespace() {
  return function transformer(tree) {
    rewriteChildren(tree);
  };
}

export function splitTinaStrongText(value) {
  const nodes = [];
  let cursor = 0;
  let match;

  TINA_TRAILING_STRONG_WHITESPACE.lastIndex = 0;
  while ((match = TINA_TRAILING_STRONG_WHITESPACE.exec(value)) !== null) {
    const [raw, strongText, trailingWhitespace] = match;

    if (match.index > cursor) {
      nodes.push({ type: "text", value: value.slice(cursor, match.index) });
    }

    nodes.push({
      type: "strong",
      children: [{ type: "text", value: strongText }],
    });
    pushText(nodes, trailingWhitespace);
    cursor = match.index + raw.length;
  }

  if (nodes.length === 0) {
    return null;
  }

  if (cursor < value.length) {
    pushText(nodes, value.slice(cursor));
  }

  return nodes;
}

function pushText(nodes, value) {
  const lastNode = nodes[nodes.length - 1];
  if (lastNode?.type === "text") {
    lastNode.value += value;
    return;
  }

  nodes.push({ type: "text", value });
}

function rewriteChildren(node) {
  if (!node || !Array.isArray(node.children)) {
    return;
  }

  const children = [];
  for (const child of node.children) {
    if (child?.type === "text" && typeof child.value === "string") {
      const splitNodes = splitTinaStrongText(child.value);
      if (splitNodes) {
        children.push(...splitNodes);
        continue;
      }
    }

    rewriteChildren(child);
    children.push(child);
  }

  node.children = children;
}
