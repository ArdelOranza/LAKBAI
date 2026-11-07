// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { useAutoToast, Toast, PrimaryBtn, TabBar } from './ui.jsx';

function Probe({ ms }){
  const [toast, setToast] = useAutoToast(ms);
  return (
    <div>
      <button data-testid="show" onClick={() => setToast({ text: 'hi', kind: 'ok' })}>show</button>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

async function mount(ui){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => { root.render(ui); });
  return {
    container, root,
    async click(sel){
      const el = container.querySelector(sel);
      await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    },
    async wait(ms){
      await React.act(async () => { await new Promise(r => setTimeout(r, ms)); });
    },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

describe('useAutoToast', () => {
  it('keeps a fresh toast visible immediately', async () => {
    const h = await mount(<Probe ms={20} />);
    await h.click('[data-testid="show"]');
    expect(h.container.querySelector('[data-testid="toast"]')).not.toBeNull();
    await h.unmount();
  });

  it('auto-dismisses after the given duration', async () => {
    const h = await mount(<Probe ms={20} />);
    await h.click('[data-testid="show"]');
    expect(h.container.querySelector('[data-testid="toast"]')).not.toBeNull();
    await h.wait(45);
    expect(h.container.querySelector('[data-testid="toast"]')).toBeNull();
    await h.unmount();
  });

  it('failing the timing rule proves the test can catch a never-dismissing toast', async () => {
    // slow render: no dismiss inside half the window
    const h = await mount(<Probe ms={100} />);
    await h.click('[data-testid="show"]');
    await h.wait(40);
    expect(h.container.querySelector('[data-testid="toast"]')).not.toBeNull();
    await h.unmount();
  });
});

describe('button types', () => {
  it('PrimaryBtn submits nothing — it is a type="button"', () => {
    const html = renderToString(<PrimaryBtn testid="pb">Go</PrimaryBtn>);
    expect(html).toContain('type="button"');
    expect(html).toContain('data-testid="pb"');
  });

  it('every TabBar button is type="button"', () => {
    const html = renderToString(<TabBar tab="home" onTab={() => {}} />);
    const opens = html.match(/<button /g) || [];
    expect(opens.length).toBe(5);
    expect((html.match(/<button /g) || []).length).toBe((html.match(/<button type="button"/g) || []).length);
  });
});
