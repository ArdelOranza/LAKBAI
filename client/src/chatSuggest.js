// Composer chips that follow the conversation instead of repeating the same
// prompts forever. Pure: no React, no icons, no side effects, so the rules can
// be tested on their own.
//
// Fares are deliberately absent here: the assistant still answers a fare
// question, but the UI never advertises it.

// One chip, not a row of them: the composer already carries the topic pills,
// so the second row is a single contextual next question.
const MAX = 1;

const DEFAULT = { id: 'beach', label: 'Beaches near me', send: 'Best beaches near me' };

/**
 * The single best chip for the current state.
 * @param {{ lastAi?: { intent?: string, cards?: Array<{name: string}> } }} state
 */
export function suggestionsFor({ lastAi } = {}){
  const out = [];
  const add = chip => {
    if (!chip || out.length >= MAX) return;
    if (out.some(c => c.label === chip.label)) return;
    out.push(chip);
  };

  const card = lastAi?.cards?.[0];
  if (card && card.name){
    add({ id: 'plan', label: 'Plan a day here', send: 'Plan a day trip to ' + card.name });
  }

  add(DEFAULT);
  return out;
}
