import { useEffect, useState } from 'react';
import { subscribeAiActivity } from './aiActivity.js';

/** True while at least one AI request is in flight. */
export function useAiActivity(){
  const [active, setActive] = useState(false);
  useEffect(() => subscribeAiActivity(setActive), []);
  return active;
}