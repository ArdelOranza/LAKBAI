import { dotState } from './aiStatus.js';

const LABEL = {
  ok: 'LakbAI is online',
  off: 'Offline',
  down: 'LakbAI is unavailable right now',
};

/**
 * The status dot beside the LakbAI mark in the chat header.
 * Green = the AI works, red = the model is down / the API can't be reached,
 * gray = the browser is offline.
 */
export default function AiStatusDot({ online = true, aiDown = false }){
  const state = dotState({ online, aiDown });
  const cls = 'online-dot' + (state === 'off' ? ' off' : state === 'down' ? ' down' : '');
  return <i className={cls} role="img" aria-label={LABEL[state]} title={LABEL[state]} />;
}
