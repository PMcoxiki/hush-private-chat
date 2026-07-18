import { Fragment, type ReactNode } from "react";

function inlineText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    : <Fragment key={`${part}-${index}`}>{part}</Fragment>);
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(<pre key={`code-${index}`} data-language={language || undefined}><code>{code.join("\n")}</code></pre>);
      index += 1;
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      blocks.push(<h3 key={`heading-${index}`}>{inlineText(line.replace(/^#{1,3}\s/, ""))}</h3>);
      index += 1;
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s/, ""));
        index += 1;
      }
      blocks.push(<ul key={`list-${index}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineText(item)}</li>)}</ul>);
      continue;
    }
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+[.)]\s/, ""));
        index += 1;
      }
      blocks.push(<ol key={`ordered-${index}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineText(item)}</li>)}</ol>);
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|```)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{inlineText(paragraph.join("\n"))}</p>);
  }
  return <div className="rich-text">{blocks}</div>;
}

export function ThinkingDots() {
  return <span className="thinking-dots" aria-label="思考中"><i /><i /><i /></span>;
}
