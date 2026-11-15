// @vitest-environment happy-dom
// The traveller's own half of the submissions table: insert one, read your own
// rows, withdraw an unreviewed one, and park an optional photo in the private
// bucket. None of it may touch another user's row.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  inserts: [], dels: [], selects: [], eqs: [], orders: [], uploads: [], buckets: [],
  insertResult: { data: { id: 'sub-1' }, error: null },
  listResult: { data: [], error: null },
  deleteResult: { error: null },
  uploadResult: { error: null },
}));

vi.mock('./supabaseClient.js', () => ({
  supabase: {
    from: () => {
      const q = {
        insert: row => { mocks.inserts.push(row); return q; },
        delete: () => { mocks.dels.push(1); return q; },
        select: cols => { if (cols) mocks.selects.push(cols); return q; },
        eq: (c, v) => { mocks.eqs.push([c, v]); return q; },
        order: (c, o) => { mocks.orders.push([c, o]); return Promise.resolve(mocks.listResult); },
        single: () => Promise.resolve(mocks.insertResult),
        then: (res, rej) => Promise.resolve(mocks.deleteResult).then(res, rej),
      };
      return q;
    },
    storage: {
      from: bucket => {
        mocks.buckets.push(bucket);
        return { upload: async (path, file, opts) => { mocks.uploads.push({ path, file, opts }); return mocks.uploadResult; } };
      },
    },
  },
}));

import { submitPlace, listMySubmissions, withdrawSubmission, uploadSubmissionPhoto } from './store.js';

beforeEach(() => {
  mocks.inserts.length = 0; mocks.dels.length = 0; mocks.selects.length = 0;
  mocks.eqs.length = 0; mocks.orders.length = 0; mocks.uploads.length = 0; mocks.buckets.length = 0;
  mocks.insertResult = { data: { id: 'sub-1' }, error: null };
  mocks.listResult = { data: [], error: null };
  mocks.deleteResult = { error: null };
  mocks.uploadResult = { error: null };
});

const DRAFT = { name: 'Kapwa Garden Cafe', town: 'Urdaneta City', category: 'Food', lng: 120.57, lat: 15.98 };

describe('submitPlace', () => {
  it('needs a signed-in traveller and hits nothing when there is none', async () => {
    const res = await submitPlace(null, DRAFT);
    expect(res.error).toBe('login required');
    expect(mocks.inserts).toHaveLength(0);
  });

  it('inserts the traveller\'s own row and hands back the new id', async () => {
    const res = await submitPlace({ id: 'u1' }, DRAFT);
    expect(mocks.inserts[0]).toMatchObject({ user_id: 'u1', name: 'Kapwa Garden Cafe', categories: ['Food'] });
    // Status is the column default: the traveller cannot write `approved`.
    expect(mocks.inserts[0]).not.toHaveProperty('status');
    expect(res.data.id).toBe('sub-1');
  });

  it('says the place is already submitted when the unique index rejects it', async () => {
    mocks.insertResult = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
    const res = await submitPlace({ id: 'u1' }, DRAFT);
    expect(res.duplicate).toBe(true);
    expect(res.error).toMatch(/already/i);
  });
});

describe('listMySubmissions', () => {
  it('is empty when logged out, without querying', async () => {
    expect(await listMySubmissions(null)).toEqual([]);
    expect(mocks.orders).toHaveLength(0);
  });

  it('scopes to the traveller and never selects *', async () => {
    await listMySubmissions({ id: 'u1' });
    expect(mocks.eqs).toContainEqual(['user_id', 'u1']);
    expect(mocks.selects[0]).not.toBe('*');
    expect(String(mocks.selects[0])).toContain('status');
  });

  it('returns the rows the query handed back', async () => {
    mocks.listResult = { data: [{ id: 'sub-1', status: 'pending' }], error: null };
    expect(await listMySubmissions({ id: 'u1' })).toHaveLength(1);
  });
});

describe('withdrawSubmission', () => {
  it('can only delete the traveller\'s own unreviewed row', async () => {
    await withdrawSubmission({ id: 'u1' }, 'sub-1');
    expect(mocks.dels).toHaveLength(1);
    expect(mocks.eqs).toEqual([['id', 'sub-1'], ['user_id', 'u1'], ['status', 'pending']]);
  });

  it('reports a failure instead of pretending the row is gone', async () => {
    mocks.deleteResult = { error: { message: 'nope' } };
    const res = await withdrawSubmission({ id: 'u1' }, 'sub-1');
    expect(res.error).toBe('nope');
  });
});

describe('uploadSubmissionPhoto', () => {
  it('parks the photo in the private bucket under the traveller\'s own prefix', async () => {
    const file = { type: 'image/jpeg' };
    const res = await uploadSubmissionPhoto({ id: 'u1' }, 'sub-1', file);
    expect(mocks.buckets).toEqual(['place-submissions']);
    expect(mocks.uploads[0].path).toBe('u1/sub-1.jpg');
    expect(mocks.uploads[0].opts.contentType).toBe('image/jpeg');
    expect(res.path).toBe('u1/sub-1.jpg');
  });

  it('needs a signed-in traveller', async () => {
    const res = await uploadSubmissionPhoto(null, 'sub-1', {});
    expect(res.error).toBe('login required');
    expect(mocks.uploads).toHaveLength(0);
  });
});
