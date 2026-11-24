// Every surface that stands for the assistant carries the LakbAI mark. A
// generic compass icon made the AI look like every other map app.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('./' + path, import.meta.url), 'utf8');

describe('AI surfaces use the LakbAI mark', () => {
  it.each(['screens/Home.jsx', 'screens/Preferences.jsx', 'screens/Itineraries.jsx'])(
    '%s imports the logo and no compass icon',
    path => {
      const src = read(path);
      expect(src).toContain("import Logo from '../logo.jsx'");
      expect(src).not.toMatch(/\bCompass\b/);
    },
  );

  it('the Saved Trips generate button carries the mark, not a compass', () => {
    const line = read('screens/SavedTab.jsx')
      .split('\n')
      .find(l => l.includes('data-testid="generate-itinerary"'));
    expect(line).toBeTruthy();
    expect(line).toContain('<Logo');
    expect(line).not.toContain('<Compass');
  });
});
