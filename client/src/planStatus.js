const DAY = 86400000;

export function planStatus(startsAt, now = new Date()){
  if (!startsAt) return null;
  const t = new Date(startsAt).getTime();
  if (Number.isNaN(t)) return null;
  const lo = t, hi = t + DAY - 1; // start-of-day .. end-of-day
  const n = now.getTime();
  if (n < lo) return 'Upcoming';
  if (n > hi) return 'Completed';
  return 'Active';
}

export function matchesFilter(status, filterKey){
  if (filterKey === 'all') return true;
  if (!status) return false;
  if (filterKey === 'active') return status === 'Active';
  if (filterKey === 'past') return status === 'Completed';
  return true;
}

export const STATUS_FILTERS = [['All','all'],['Active','active'],['Past','past']];
