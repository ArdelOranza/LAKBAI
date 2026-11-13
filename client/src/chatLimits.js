/**
 * The API rejects a message longer than 500 characters (`MESSAGE_MAX` in
 * server/index.js). The composer mirrors that limit so a long paste or a long
 * voice transcript cannot turn into a 400 that reads like an AI outage.
 */
export const MAX_MESSAGE = 500;

/** Trim and cap one outgoing chat message to the server's limit. */
export function clampMessage(text){
  return String(text ?? '').trim().slice(0, MAX_MESSAGE);
}
