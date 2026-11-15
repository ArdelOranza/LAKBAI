// @vitest-environment happy-dom
// Profile → My submissions: what the traveller sent, what state it is in, and
// the one thing they can still do about an unreviewed row.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const store = vi.hoisted(() => ({
  listMySubmissions: vi.fn(async () => []),
  withdrawSubmission: vi.fn(async () => ({})),
}));
vi.mock('../store.js', () => store);
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import MySubmissions from './MySubmissions.jsx';

const ROWS = [
  { id: 's1', name: 'Kapwa Garden Cafe', town: 'Urdaneta City', status: 'pending', created_at: '2026-11-01T02:00:00Z' },
  { id: 's2', name: 'Bolinao Cove Stay', town: 'Bolinao', status: 'approved', created_at: '2026-10-20T02:00:00Z' },
  { id: 's3', name: 'Ghost Cafe', town: 'Villasis', status: 'rejected', created_at: '2026-10-18T02:00:00Z', review_note: 'Could not find this place.' },
];

async function mount(rows = ROWS){
  store.listMySubmissions.mockResolvedValue(rows);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { pop: vi.fn(), showToast: vi.fn() };
  await React.act(async () => { root.render(<MySubmissions {...props}/>); });
  await React.act(async () => { await new Promise(r => setTimeout(r, 0)); });
  const find = sel => container.querySelector(sel);
  return {
    container, props, find,
    text: () => container.textContent,
    rows: () => Array.from(container.querySelectorAll('[data-testid="submission-row"]')),
    click: async el => { await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  store.listMySubmissions.mockReset().mockResolvedValue([]);
  store.withdrawSubmission.mockReset().mockResolvedValue({});
});

describe('MySubmissions', () => {
  it('shows each state in the traveller\'s words, with the editor\'s reason on a rejection', async () => {
    const h = await mount();
    const text = h.rows().map(r => r.textContent);
    expect(text[0]).toContain('Pending');
    expect(text[1]).toContain('Live');
    expect(text[2]).toContain('Not added');
    expect(text[2]).toContain('Could not find this place.');
    await h.unmount();
  });

  it('offers Withdraw on an unreviewed row only', async () => {
    const h = await mount();
    const rows = h.rows();
    expect(rows[0].querySelector('[data-testid="withdraw-submission"]')).not.toBeNull();
    expect(rows[1].querySelector('[data-testid="withdraw-submission"]')).toBeNull();
    expect(rows[2].querySelector('[data-testid="withdraw-submission"]')).toBeNull();
    await h.unmount();
  });

  it('withdraws only after an explicit confirm', async () => {
    const h = await mount();
    const row = h.rows()[0];
    await h.click(row.querySelector('[data-testid="withdraw-submission"]'));
    expect(store.withdrawSubmission).not.toHaveBeenCalled();
    await h.click(h.find('[data-testid="confirm-withdraw"]'));
    expect(store.withdrawSubmission).toHaveBeenCalledWith({ id: 'u1' }, 's1');
    // The row leaves the list once the write succeeded.
    expect(h.rows().some(r => r.textContent.includes('Kapwa Garden Cafe'))).toBe(false);
    await h.unmount();
  });

  it('explains the empty state instead of showing a blank pane', async () => {
    const h = await mount([]);
    expect(h.find('[data-testid="my-submissions-empty"]').textContent).toMatch(/map/i);
    await h.unmount();
  });
});
