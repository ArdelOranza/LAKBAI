import React from 'react';

// Markdown-lite renderer for AI chat text. The assistant replies come back as
// prose with **bold** place names and "-" bullet lines; rendering them raw made
// every reply read like a dump. This covers exactly what the model emits:
// bold spans, bullet grouping, and blank-line paragraphs. Nothing else — no
// headings, images or links, so a rogue reply can't inject arbitrary HTML.
const BOLD = /\*\*([^*]+)\*\*/;

/** "**name** rest" → [{t:'bold',v:'name'} , {t:'plain',v:' rest'}]; unmatched ** stays literal. */
export function mdInline(text){
  const s = String(text ?? '');
  const segs = [];
  let rest = s;
  while (rest){
    const m = BOLD.exec(rest);
    if (!m){ segs.push({ t: 'plain', v: rest }); break; }
    if (m.index > 0) segs.push({ t: 'plain', v: rest.slice(0, m.index) });
    segs.push({ t: 'bold', v: m[1] });
    rest = rest.slice(m.index + m[0].length);
  }
  return segs;
}

const BULLET = /^\s*(?:[-•]|\*)\s+/;

/** Text → blocks: paragraphs split on blank lines, consecutive bullet lines
 *  grouped into one ul. Blocks carry inline segments already parsed. */
export function mdBlocks(text){
  const paras = String(text ?? '').split(/\n{2,}/);
  const blocks = [];
  for (const para of paras){
    const lines = para.split('\n');
    let list = null;
    let paraLines = [];
    function flushPara(){
      if (paraLines.length){
        blocks.push({ type: 'p', segs: mdInline(paraLines.join('\n')) });
        paraLines = [];
      }
    }
    for (const line of lines){
      if (BULLET.test(line)){
        flushPara();
        if (!list){ list = { type: 'ul', items: [] }; blocks.push(list); }
        list.items.push(mdInline(line.replace(BULLET, '')));
      } else if (line.trim()){
        list = null;
        paraLines.push(line);
      } else if (paraLines.length){
        paraLines.push(''); // preserve intra-paragraph wrap as a blank edge
      }
    }
    flushPara();
  }
  return blocks;
}

function Segs({ segs }){
  return segs.map((s, i) => s.t === 'bold' ? <strong key={i}>{s.v}</strong> : <React.Fragment key={i}>{s.v}</React.Fragment>);
}

/** Renders mdBlocks to <p>/<ul>. Non-string loading placeholders pass through. */
export function MdText({ text }){
  if (typeof text !== 'string') return text;
  const blocks = mdBlocks(text);
  return (
    <>
      {blocks.map((b, i) => b.type === 'ul'
        ? <ul key={i}>{b.items.map((segs, j) => <li key={j}><Segs segs={segs}/></li>)}</ul>
        : <p key={i}><Segs segs={b.segs}/></p>)}
    </>
  );
}
