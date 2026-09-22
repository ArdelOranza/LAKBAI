const KEY = 'lakbai-review-outbox';
function readRaw(){
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function readOutbox(){
  return readRaw();
}
export function queueReview(row){
  const box = readRaw();
  box.push({ ...row, at: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(box));
  return box;
}
export function takeAll(){
  const box = readRaw();
  localStorage.removeItem(KEY);
  return box;
}
export function stripForInsert(row){
  const { at, ...cols } = row;
  return cols;
}
