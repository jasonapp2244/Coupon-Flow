import type { ReactNode } from 'react';

/**
 * Renders admin-written plain text safely (no HTML): blank lines split paragraphs,
 * lines starting with "## " / "### " become headings and "- " lines become a bullet list.
 */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];

  text.replace(/\r\n/g, '\n').split(/\n{2,}/).forEach((block, i) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    if (lines.every(l => /^[-*] /.test(l))) {
      blocks.push(<ul key={i}>{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>);
    } else if (lines[0].startsWith('### ')) {
      blocks.push(<h3 key={i}>{lines[0].slice(4)}</h3>);
      if (lines.length > 1) blocks.push(<p key={`${i}p`}>{lines.slice(1).join(' ')}</p>);
    } else if (lines[0].startsWith('## ')) {
      blocks.push(<h2 key={i}>{lines[0].slice(3)}</h2>);
      if (lines.length > 1) blocks.push(<p key={`${i}p`}>{lines.slice(1).join(' ')}</p>);
    } else {
      blocks.push(<p key={i}>{lines.join(' ')}</p>);
    }
  });

  return <div className="prose-body">{blocks}</div>;
}
