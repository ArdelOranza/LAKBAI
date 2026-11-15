import { describe, it, expect } from 'vitest';
import { answerLead } from './chatAnswer.js';

describe('answerLead', () => {
  it('keeps only the lead-in when the answer is a place-by-place dump', () => {
    const text = 'Closest to you:\n- **Patar Beach** (Bolinao · 4.8★ · 351 reviews) — White sand.\n- **Bolinao Falls** (Bolinao · 4.5★) — Cold water.';
    expect(answerLead(text, true)).toEqual({ lead: 'Closest to you:', kind: 'label' });
  });

  it('keeps prose that is not a structured place list', () => {
    const text = 'The beaches around Bolinao are best at low tide.\n- Bring cash.\n- Go early.';
    expect(answerLead(text, true)).toEqual({ lead: text, kind: 'prose' });
  });

  it('keeps the whole answer when there are no cards to carry it', () => {
    const text = 'Closest to you:\n- **Patar Beach** — White sand.';
    expect(answerLead(text, false)).toEqual({ lead: text, kind: 'prose' });
  });

  it('handles a dump with no lead-in and empty input', () => {
    expect(answerLead('- **Patar Beach** — White sand.', true)).toEqual({ lead: '', kind: 'label' });
    expect(answerLead('', true)).toEqual({ lead: '', kind: 'prose' });
  });

  it('treats a long lead-in as prose, not a section label', () => {
    const long = 'These are the verified places closest to where you are right now, ordered by drive time from your GPS fix:';
    expect(answerLead(`${long}\n- **Patar Beach** — White sand.`, true)).toEqual({ lead: long, kind: 'prose' });
  });

  it('keeps a day plan whose bullets are labelled by time of day, not by place', () => {
    // The model answers an itinerary request with cards for the stops AND a
    // plan whose bullets are **Morning:** / **Afternoon:**. Only the bullets
    // that repeat a card name may be dropped — the plan itself is the answer.
    const text = [
      'Here is a 2-day itinerary for 2 people in Bolinao and Alaminos.',
      '',
      '### **Day 1: Bolinao Heritage**',
      '',
      '*   **Morning:** Patar Beach, then the lighthouse.',
      '*   **Afternoon:** Bolinao Falls and the market.',
      '',
      '### **Day 2: Alaminos Islands**',
      '',
      '*   **Morning:** Hundred Islands boat tour.',
    ].join('\n');
    expect(answerLead(text, true, ['Patar Beach', 'Bolinao Falls']))
      .toEqual({ lead: text, kind: 'prose' });
  });

  it('still drops bullets that only repeat the result cards', () => {
    const text = 'Closest to you:\n- **Patar Beach** (Bolinao · 4.8★ · 351 reviews) — White sand.\n- **Bolinao Falls** (Bolinao · 4.5★) — Cold water.';
    expect(answerLead(text, true, ['Patar Beach', 'Bolinao Falls']))
      .toEqual({ lead: 'Closest to you:', kind: 'label' });
  });
});
