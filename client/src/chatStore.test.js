// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  remote: [],
  listError: null,
  insertError: null,
  inserts: [],
  upserts: [],
  tables: [],
  selectCols: [],
}));

function query(){
  const q = {
    eq: () => q,
    order: () => q,
    limit: () => Promise.resolve({ data: state.remote, error: state.listError }),
    then: (res, rej) => Promise.resolve({ data: state.remote, error: state.listError }).then(res, rej),
  };
  return q;
}

vi.mock('./supabaseClient.js', () => ({
  supabase: {
    from: (table) => {
      state.tables.push(table);
      return {
        select: (cols) => { state.selectCols.push(cols); return query(); },
        insert: (row) => {
          state.inserts.push(row);
          return {
            select: () => ({
              single: async () => state.insertError
                ? { data: null, error: state.insertError }
                : {
                    data: { ...row, id: 'cloud-1', created_at: '2026-01-01T00:00:00.000Z' },
                    error: null,
                  },
            }),
          };
        },
        upsert: async (row, opts) => { state.upserts.push({ row, opts }); return { error: null }; },
      };
    },
  },
}));

import {
  threadTitle, cleanMessages, saveThread, listThreads, latestThread,
} from './chatStore.js';

const USER = { id: 'u1' };

function reset(){
  state.remote = [];
  state.listError = null;
  state.insertError = null;
  state.inserts.length = 0;
  state.upserts.length = 0;
  state.tables.length = 0;
  state.selectCols.length = 0;
  localStorage.clear();
}

beforeEach(reset);

describe('threadTitle', () => {
  it('uses the first traveler message', () => {
    expect(threadTitle([
      { role: 'ai', text: 'Welcome' },
      { role: 'user', text: 'Best beaches near me?' },
    ])).toBe('Best beaches near me?');
  });

  it('truncates long titles and falls back for empty chats', () => {
    expect(threadTitle([{ role: 'user', text: 'x'.repeat(120) }])).toHaveLength(60);
    expect(threadTitle([{ role: 'ai', text: 'Welcome' }])).toBe('New chat');
  });
});

describe('cleanMessages', () => {
  it('drops in-flight placeholders and keeps the newest 60 messages', () => {
    const msgs = Array.from({ length: 70 }, (_, i) => ({ id: 'm' + i, role: 'user', text: 'q' + i }));
    msgs.push({ id: 'loading', role: 'ai', loading: true });
    const out = cleanMessages(msgs);
    expect(out).toHaveLength(60);
    expect(out.some(m => m.loading)).toBe(false);
    expect(out[out.length - 1].text).toBe('q69');
  });

  it('stores lean cards (no full spot payload) so history stays light', () => {
    const out = cleanMessages([{
      id: 'm1', role: 'ai', text: 'Here',
      cards: [{ id: 'c1', name: 'Patar Beach', lng: 119.79, lat: 16.12, tags: ['beach'], spot: { huge: 'payload' } }],
    }]);
    expect(out[0].cards[0]).toMatchObject({ id: 'c1', name: 'Patar Beach', lng: 119.79, lat: 16.12 });
    expect(out[0].cards[0].spot).toBeUndefined();
  });
});

describe('saveThread', () => {
  it('mirrors locally before the network so a reload never loses the chat', async () => {
    const saved = await saveThread(USER, {
      id: 'local-1',
      messages: [{ id: 'm1', role: 'user', text: 'Hello' }, { id: 'm2', role: 'ai', text: 'Hi' }],
    });
    expect(saved.id).toBe('cloud-1');
    const mirror = JSON.parse(localStorage.getItem('lakbai.chat:u1'));
    expect(mirror[0].id).toBe('cloud-1');
    expect(mirror[0].title).toBe('Hello');
    expect(state.inserts[0]).toMatchObject({ user_id: 'u1', title: 'Hello' });
  });

  it('updates an existing cloud thread instead of creating duplicates', async () => {
    await saveThread(USER, {
      id: '11111111-1111-4111-8111-111111111111',
      created_at: '2026-01-01T00:00:00.000Z',
      messages: [{ id: 'm1', role: 'user', text: 'Hello' }],
    });
    expect(state.inserts).toHaveLength(0);
    expect(state.upserts[0].row.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(state.upserts[0].opts).toEqual({ onConflict: 'id' });
  });

  it('does not create an empty thread for a welcome-only chat', async () => {
    await saveThread(USER, { id: 'local-2', messages: [{ id: 'welcome', role: 'ai', text: 'Hi' }] });
    expect(state.inserts).toHaveLength(0);
    expect(localStorage.getItem('lakbai.chat:u1')).toBeNull();
  });

  it('keeps a local copy when the cloud write fails', async () => {
    state.insertError = { message: 'offline' };
    const saved = await saveThread(USER, {
      id: 'local-3',
      messages: [{ id: 'm1', role: 'user', text: 'Offline question' }],
    });
    expect(saved.id).toBe('local-3');
    expect(saved.error).toBe('offline');
    const mirror = JSON.parse(localStorage.getItem('lakbai.chat:u1'));
    expect(mirror[0].id).toBe('local-3');
    // The next save retries the insert with the same local thread.
    state.insertError = null;
    const retried = await saveThread(USER, { id: 'local-3', messages: saved.messages });
    expect(retried.id).toBe('cloud-1');
    expect(state.inserts).toHaveLength(2);
  });
});

describe('listThreads', () => {
  it('merges the account history with the local mirror, newest first', async () => {
    state.remote = [
      { id: 'cloud-9', title: 'From another device', messages: [{ id: 'a', role: 'user', text: 'x' }], updated_at: '2026-02-01T00:00:00.000Z' },
    ];
    await saveThread(USER, {
      id: 'local-4',
      messages: [{ id: 'm1', role: 'user', text: 'Local chat' }],
    });
    // saveThread promoted local-4 to cloud-1; put it in the remote list too.
    state.remote.push({ id: 'cloud-1', title: 'Local chat', messages: [{ id: 'm1', role: 'user', text: 'Local chat' }], updated_at: '2026-01-01T00:00:00.000Z' });
    const out = await listThreads(USER);
    expect(out[0].title).toBe('From another device');
    expect(out.some(t => t.title === 'Local chat')).toBe(true);
    expect(state.selectCols[0]).toContain('messages');
  });

  it('falls back to the local mirror when the account is offline', async () => {
    state.remote = [];
    state.listError = { message: 'offline' };
    await saveThread(USER, {
      id: 'local-5',
      messages: [{ id: 'm1', role: 'user', text: 'Offline chat' }],
    });
    const out = await listThreads(USER);
    expect(out[0].title).toBe('Offline chat');
  });
});

describe('latestThread', () => {
  it('restores the most recent thread that has a message', async () => {
    state.remote = [
      { id: 'c2', title: 'Newest', messages: [{ id: 'm2', role: 'user', text: 'b' }], updated_at: '2026-03-01T00:00:00.000Z' },
      { id: 'c1', title: 'Older', messages: [{ id: 'm1', role: 'user', text: 'a' }], updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    const t = await latestThread(USER);
    expect(t.id).toBe('c2');
    expect(t.messages[0].text).toBe('b');
  });
});