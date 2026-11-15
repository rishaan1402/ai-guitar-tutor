/**
 * Renders the light Markdown the AI writes (headings, **bold**, *italic*,
 * bullet and numbered lists, paragraphs) as real text, never raw HTML.
 */
import { Fragment, type ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-${k++}`} className="font-semibold text-cream">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={`${keyBase}-${k++}`} className="rounded bg-cream/10 px-1 font-mono text-[0.92em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={`${keyBase}-${k++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${blocks.length}-${i}`)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={`o${blocks.length}`} className="list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul key={`u${blocks.length}`} className="list-disc space-y-1 pl-5">{items}</ul>
      ),
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const num = /^\d+[.)]\s+(.*)$/.exec(line);
    // a line that is only bold text reads as a small heading
    const boldHead = /^\*\*([^*]+)\*\*:?$/.exec(line);
    if (!line) {
      flushPara();
      flushList();
    } else if (h || boldHead) {
      flushPara();
      flushList();
      blocks.push(<p key={`h${blocks.length}`} className="pt-1 font-semibold text-cream">{inline((h ? h[2] : boldHead![1]).replace(/\*\*/g, ""), `h${blocks.length}`)}</p>);
    } else if (bullet || num) {
      flushPara();
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className={`space-y-2 ${className}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
