export function sessionGet(key){
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
export function sessionSet(key, value){
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* full storage: ignore */ }
}
