import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { apiUrl } from './apiBase.js';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir = SRC, out = []){
  for (const entry of readdirSync(dir, { withFileTypes: true })){
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(path);
  }
  return out;
}

afterEach(() => vi.unstubAllEnvs());

describe('apiUrl', () => {
  it('keeps requests relative when VITE_API_URL is unset (dev proxy)', () => {
    vi.stubEnv('VITE_API_URL', '');
    expect(apiUrl('/api/spots')).toBe('/api/spots');
  });

  it('prefixes the configured API origin and trims trailing slashes', () => {
    vi.stubEnv('VITE_API_URL', 'https://lakbai-api.onrender.com/');
    expect(apiUrl('/api/places?q=falls')).toBe('https://lakbai-api.onrender.com/api/places?q=falls');
  });

  it('never produces a double slash', () => {
    vi.stubEnv('VITE_API_URL', 'https://lakbai-api.onrender.com///');
    expect(apiUrl('/api/spots')).toBe('https://lakbai-api.onrender.com/api/spots');
  });

  it('leaves no bare /api fetch in the client source', () => {
    const offenders = sourceFiles()
      .filter(file => /fetch(?:Impl)?\(\s*[`'"]\/api\//.test(readFileSync(file, 'utf8')))
      .map(file => file.slice(SRC.length));
    expect(offenders).toEqual([]);
  });
});
