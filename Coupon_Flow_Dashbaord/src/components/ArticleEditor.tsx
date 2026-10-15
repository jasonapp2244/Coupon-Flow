import { useId, useRef, useState, type ReactNode } from 'react';
import { Bold, Eye, Heading2, Heading3, Italic, Link2, List, ListOrdered, PenLine, Quote } from 'lucide-react';

/*
 * The blog article editor: a plain-text box with a formatting toolbar and a preview that looks like
 * the public site. The formatting rules match the website's renderer
 * (Coupon_Flow_Website src/components/RichText.tsx), so what the preview shows is what visitors get.
 */

/** **bold**, *italic*, [text](link); a link must be a site page ("/coupons") or a full web address. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={k} className="font-semibold text-slate-900">{inline(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{inline(m[2], k)}</em>);
    else if (/^(\/(?!\/)|https?:\/\/)/i.test(m[4])) {
      out.push(<span key={k} className="font-semibold text-emerald-700 underline underline-offset-2" title={m[4]}>{m[3]}</span>);
    } else out.push(m[0]);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ArticlePreview({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  text.replace(/\r\n/g, '\n').split(/\n{2,}/).forEach((block, i) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const k = String(i);
    if (lines.every(l => /^[-*] /.test(l))) {
      blocks.push(<ul key={k} className="mt-4 list-disc space-y-1.5 pl-6">{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${k}-${j}`)}</li>)}</ul>);
    } else if (lines.every(l => /^\d+[.)] /.test(l))) {
      blocks.push(<ol key={k} className="mt-4 list-decimal space-y-1.5 pl-6">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+[.)] /, ''), `${k}-${j}`)}</li>)}</ol>);
    } else if (lines.every(l => l.startsWith('>'))) {
      blocks.push(<blockquote key={k} className="mt-5 rounded-r-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 font-medium text-slate-800">{inline(lines.map(l => l.replace(/^>\s?/, '')).join(' '), k)}</blockquote>);
    } else if (lines[0].startsWith('### ') || lines[0].startsWith('## ')) {
      const h3 = lines[0].startsWith('### ');
      const heading = inline(lines[0].slice(h3 ? 4 : 3), `${k}h`);
      blocks.push(h3
        ? <h3 key={k} className="mt-6 text-lg font-semibold text-slate-900">{heading}</h3>
        : <h2 key={k} className="mt-8 text-xl font-bold text-slate-900">{heading}</h2>);
      if (lines.length > 1) blocks.push(<p key={`${k}p`} className="mt-3 leading-relaxed">{inline(lines.slice(1).join(' '), `${k}p`)}</p>);
    } else {
      blocks.push(<p key={k} className="mt-4 leading-relaxed">{inline(lines.join(' '), k)}</p>);
    }
  });
  if (!blocks.length) return <p className="text-sm text-slate-400">Nothing to preview yet. Write the article first.</p>;
  return <div className="text-[15px] text-slate-600 [&>:first-child]:mt-0">{blocks}</div>;
}

export function wordCount(text: string) {
  return text.replace(/[#*>[\]()-]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

type Tool = { label: string; keys?: string; icon: ReactNode; run: (t: HTMLTextAreaElement) => void };

/**
 * Replaces the selection through the browser's own edit command, so Ctrl+Z still undoes it,
 * then selects `select` (offsets inside the inserted text) for the next keystroke.
 */
function insert(t: HTMLTextAreaElement, start: number, end: number, text: string, select?: [number, number]) {
  t.focus();
  t.setSelectionRange(start, end);
  if (!document.execCommand('insertText', false, text)) {
    t.setRangeText(text, start, end, 'end');
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (select) t.setSelectionRange(start + select[0], start + select[1]);
}

/** Wraps the selection in a mark, or removes it when the selection is already wrapped. */
function wrap(mark: string, placeholder: string) {
  return (t: HTMLTextAreaElement) => {
    const { selectionStart: s, selectionEnd: e, value } = t;
    const picked = value.slice(s, e);
    if (value.slice(s - mark.length, s) === mark && value.slice(e, e + mark.length) === mark) {
      insert(t, s - mark.length, e + mark.length, picked, [0, picked.length]);
      return;
    }
    const inner = picked || placeholder;
    insert(t, s, e, `${mark}${inner}${mark}`, [mark.length, mark.length + inner.length]);
  };
}

/** Starts every selected line with a prefix (a heading, list or quote), on a block of its own. */
function prefix(make: (i: number) => string, placeholder: string) {
  return (t: HTMLTextAreaElement) => {
    const { value } = t;
    const s = value.lastIndexOf('\n', t.selectionStart - 1) + 1;
    const nl = value.indexOf('\n', t.selectionEnd);
    const e = nl === -1 ? value.length : nl;
    const lines = (value.slice(s, e) || placeholder).split('\n');
    const strip = (l: string) => l.replace(/^(#{2,3} |[-*] |\d+[.)] |>\s?)/, '');
    let body = lines.map((l, i) => make(i) + strip(l)).join('\n');
    // Blocks are separated by blank lines; add them where the neighbours touch.
    const before = s > 0 && value.slice(Math.max(0, s - 2), s) !== '\n\n' ? (value[s - 1] === '\n' ? '\n' : '\n\n') : '';
    const after = e < value.length && value.slice(e, e + 2) !== '\n\n' ? (value[e] === '\n' ? '\n' : '\n\n') : '';
    body = before + body + after;
    insert(t, s, e, body, [before.length + make(0).length, body.length - after.length]);
  };
}

function link(t: HTMLTextAreaElement) {
  const { selectionStart: s, selectionEnd: e, value } = t;
  const label = value.slice(s, e) || 'link text';
  const text = `[${label}](/coupons)`;
  // Select the address so the editor can type over it straight away.
  insert(t, s, e, text, [label.length + 3, text.length - 1]);
}

const TOOLS: (Tool | 'sep')[] = [
  { label: 'Heading', icon: <Heading2 size={15} />, run: prefix(() => '## ', 'Section heading') },
  { label: 'Sub-heading', icon: <Heading3 size={15} />, run: prefix(() => '### ', 'Sub-heading') },
  'sep',
  { label: 'Bold', keys: 'Ctrl+B', icon: <Bold size={15} />, run: wrap('**', 'bold text') },
  { label: 'Italic', keys: 'Ctrl+I', icon: <Italic size={15} />, run: wrap('*', 'italic text') },
  { label: 'Link', keys: 'Ctrl+K', icon: <Link2 size={15} />, run: link },
  'sep',
  { label: 'Bullet list', icon: <List size={15} />, run: prefix(() => '- ', 'List item') },
  { label: 'Numbered list', icon: <ListOrdered size={15} />, run: prefix(i => `${i + 1}. `, 'First step') },
  { label: 'Quote or tip', icon: <Quote size={15} />, run: prefix(() => '> ', 'A tip worth remembering') },
];

const SHORTCUTS: Record<string, string> = { b: 'Bold', i: 'Italic', k: 'Link' };

export function ArticleEditor({ label, value, onChange, placeholder, error }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
}) {
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const words = wordCount(value);
  const minutes = Math.max(1, Math.round(words / 200));

  const apply = (tool: Tool) => { if (box.current) tool.run(box.current); };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium" role="tablist" aria-label="Editor view">
          {(['write', 'preview'] as const).map(m => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {m === 'write' ? <PenLine size={13} /> : <Eye size={13} />}{m === 'write' ? 'Write' : 'Preview'}
            </button>
          ))}
        </div>
      </div>

      <div className={`overflow-hidden rounded-lg border bg-white transition-all focus-within:ring-2 focus-within:ring-blue-100 ${error ? 'border-red-300' : 'border-slate-200 focus-within:border-blue-400'}`}>
        {mode === 'write' ? (
          <>
            <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-1.5 py-1" role="toolbar" aria-label="Formatting">
              {TOOLS.map((tool, i) => tool === 'sep'
                ? <span key={i} className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
                : (
                  <button key={tool.label} type="button" onClick={() => apply(tool)} title={tool.keys ? `${tool.label} (${tool.keys})` : tool.label}
                    aria-label={tool.label} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm">
                    {tool.icon}
                  </button>
                ))}
            </div>
            <textarea
              id={id}
              ref={box}
              value={value}
              placeholder={placeholder}
              rows={22}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => {
                const name = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey ? SHORTCUTS[e.key.toLowerCase()] : undefined;
                const tool = name && TOOLS.find((t): t is Tool => t !== 'sep' && t.label === name);
                if (tool) { e.preventDefault(); apply(tool); }
              }}
              className="block w-full resize-y px-4 py-3 font-mono text-[13px] leading-6 text-slate-800 outline-none placeholder:text-slate-400"
            />
          </>
        ) : (
          <div className="max-h-[38rem] min-h-[20rem] overflow-y-auto px-6 py-5"><ArticlePreview text={value} /></div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          <span>## heading · **bold** · *italic* · [text](/page) · - list · 1. steps · &gt; tip · blank line = new paragraph</span>
          <span className="font-medium text-slate-600">{words.toLocaleString()} words · {minutes} min read</span>
        </div>
      </div>
    </div>
  );
}
