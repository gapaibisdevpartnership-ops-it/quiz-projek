import { Fragment, type ReactNode } from "react";

/**
 * Renders plain text that may contain `**bold**`, `*italic*`, and newlines.
 * Not a full Markdown parser — just enough for instructions-style fields.
 */
export function renderRichText(text: string): ReactNode {
  return text.split("\n").map((line, lineIndex, lines) => (
    <Fragment key={lineIndex}>
      {renderInline(line)}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function renderInline(line: string): ReactNode {
  const tokens = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return <em key={i}>{token.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{token}</Fragment>;
  });
}
