export interface MonthRange {
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function previousMonthRange(today: Date = new Date()): MonthRange {
  const year = today.getFullYear();
  const month = today.getMonth();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: formatDate(start), end: formatDate(end) };
}
