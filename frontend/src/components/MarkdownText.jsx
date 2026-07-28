/**
 * Lightweight markdown renderer for AI-generated clinical text.
 * Handles: # / ## headings, **bold**, *italic*, bullet lists (-, *, •),
 * numbered lists (1. 2.), and paragraph breaks. No external dependency.
 */

const inline = (text) => {
  // **bold**
  let html = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // *italic* (negative lookahead/behind to avoid eating bullets)
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  return html;
};

const BULLET_RE = /^\s*(?:[-*•]|\d+\.)\s+/;

export default function MarkdownText({ children, className = "" }) {
  const raw = (children || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return null;

  const blocks = raw.split(/\n\s*\n/);
  const elements = [];

  blocks.forEach((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return;
    const lines = trimmed.split("\n");

    // Bullet list block
    const bulletLines = lines.filter((l) => BULLET_RE.test(l));
    if (bulletLines.length && bulletLines.length >= Math.max(1, lines.length - 1)) {
      elements.push(
        <ul key={bi} className="list-disc pl-5 space-y-1 my-2">
          {lines.map((l, i) => {
            if (!l.trim()) return null;
            const content = l.replace(BULLET_RE, "").trim();
            return (
              <li
                key={i}
                dangerouslySetInnerHTML={{ __html: inline(content) }}
              />
            );
          })}
        </ul>
      );
      return;
    }

    // Heading block (first line starts with #)
    if (trimmed.startsWith("#")) {
      const m = lines[0].match(/^(#{1,4})\s+(.*)$/);
      if (m) {
        const level = m[1].length;
        const headingText = m[2];
        const Tag = level <= 2 ? "h3" : "h4";
        elements.push(
          <Tag
            key={bi}
            className={`font-semibold mt-3 mb-1 ${level <= 2 ? "text-base" : "text-sm"}`}
            dangerouslySetInnerHTML={{ __html: inline(headingText) }}
          />
        );
        const rest = lines.slice(1).join(" ").trim();
        if (rest) {
          elements.push(
            <p
              key={`${bi}-rest`}
              className="leading-relaxed mb-2"
              dangerouslySetInnerHTML={{ __html: inline(rest) }}
            />
          );
        }
        return;
      }
    }

    // Plain paragraph — collapse internal newlines to spaces
    const para = lines.map((l) => l.trim()).filter(Boolean).join(" ");
    elements.push(
      <p
        key={bi}
        className="leading-relaxed mb-3"
        dangerouslySetInnerHTML={{ __html: inline(para) }}
      />
    );
  });

  return <div className={className}>{elements}</div>;
}
