import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Inline marks inside a line: **bold**, *italic* and [text](link). Links go only to site pages
 * ("/coupons") or full web addresses; anything else is shown as plain text. No HTML is ever rendered.
 * The admin's article preview (Dashboard src/components/ArticleEditor.tsx) uses the same rules.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{inline(m[2], k)}</em>);
    else {
      const [label, href] = [m[3], m[4]];
      if (/^\/(?!\/)/.test(href)) out.push(<Link key={k} to={href}>{label}</Link>);
      else if (/^https?:\/\//i.test(href)) out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
      else out.push(m[0]);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Renders admin-written text safely (no HTML). Blank lines split blocks; a block can be a heading
 * ("## " or "### "), a bullet list ("- "), a numbered list ("1. "), a quote ("> ") or a paragraph.
 */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];

  text.replace(/\r\n/g, '\n').split(/\n{2,}/).forEach((block, i) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const k = String(i);

    if (lines.every(l => /^[-*] /.test(l))) {
      blocks.push(<ul key={k}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${k}-${j}`)}</li>)}</ul>);
    } else if (lines.every(l => /^\d+[.)] /.test(l))) {
      blocks.push(<ol key={k}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+[.)] /, ''), `${k}-${j}`)}</li>)}</ol>);
    } else if (lines.every(l => l.startsWith('>'))) {
      blocks.push(<blockquote key={k}>{inline(lines.map(l => l.replace(/^>\s?/, '')).join(' '), k)}</blockquote>);
    } else if (lines[0].startsWith('### ') || lines[0].startsWith('## ')) {
      const h3 = lines[0].startsWith('### ');
      const heading = inline(lines[0].slice(h3 ? 4 : 3), `${k}h`);
      blocks.push(h3 ? <h3 key={k}>{heading}</h3> : <h2 key={k}>{heading}</h2>);
      if (lines.length > 1) blocks.push(<p key={`${k}p`}>{inline(lines.slice(1).join(' '), `${k}p`)}</p>);
    } else {
      blocks.push(<p key={k}>{inline(lines.join(' '), k)}</p>);
    }
  });

  return <div className="prose-body">{blocks}</div>;
}
