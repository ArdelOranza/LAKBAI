const KEY = 'lakbai-review-outbox';
function readRaw(){
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function readOutbox(){
  return readRaw();
}
function queueReview(row){
  const box = readRaw();
  box.push({ ...row, at: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(box));
  return box;
}
function takeAll(){
  const box = readRaw();
  localStorage.removeItem(KEY);
  return box;
}
function stripForInsert(row){
  const { at, ...cols } = row;
  return cols;
}
module.exports = { readOutbox, queueReview, takeAll, stripForInsert };
