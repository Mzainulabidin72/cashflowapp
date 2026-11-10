import { formatDayMonth, getPrefs, monthRange } from "./prefs.js";

export const toISODate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
);

export const dateFromISO = (iso) => new Date(`${iso}T00:00:00`);

export const todayISO = () => toISODate(new Date());

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

function startOfWeek(date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function periodBounds(filter, customFrom, customTo, reference = new Date(), monthStartDay = getPrefs().monthStartDay) {
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  switch (filter) {
    case "week": {
      const from = startOfWeek(today);
      const to = new Date(from);
      to.setDate(to.getDate() + 6);
      return { from: toISODate(from), to: toISODate(to) };
    }
    case "month":
      return monthRange(monthStartDay, today);
    case "lastMonth": {
      const current = monthRange(monthStartDay, today);
      const previousReference = dateFromISO(current.from);
      previousReference.setDate(previousReference.getDate() - 1);
      return monthRange(monthStartDay, previousReference);
    }
    case "year":
      return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
    case "custom":
      return { from: customFrom || null, to: customTo || null };
    default:
      return { from: null, to: toISODate(today) };
  }
}

export function previousPeriodBounds(filter, bounds, monthStartDay = getPrefs().monthStartDay) {
  if (filter === "week" && bounds.from && bounds.to) {
    const from = dateFromISO(bounds.from);
    const to = dateFromISO(bounds.to);
    from.setDate(from.getDate() - 7);
    to.setDate(to.getDate() - 7);
    return { from: toISODate(from), to: toISODate(to) };
  }
  if ((filter === "month" || filter === "lastMonth") && bounds.from) {
    const previousReference = dateFromISO(bounds.from);
    previousReference.setDate(previousReference.getDate() - 1);
    return monthRange(monthStartDay, previousReference);
  }
  if (filter === "year" && bounds.from) {
    const year = Number(bounds.from.slice(0, 4)) - 1;
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  if (filter === "custom" && bounds.from && bounds.to) {
    const start = dateFromISO(bounds.from);
    const end = dateFromISO(bounds.to);
    const duration = Math.round((end - start) / 86400000) + 1;
    if (duration < 1) return null;
    end.setDate(end.getDate() - duration);
    start.setDate(start.getDate() - duration);
    return { from: toISODate(start), to: toISODate(end) };
  }
  return null;
}

export function inRange(date, bounds) {
  if (!date || (bounds.from && date < bounds.from) || (bounds.to && date > bounds.to)) return false;
  return !(bounds.from && bounds.to && bounds.from > bounds.to);
}

export function sumByType(transactions, type) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
}

function transactionDelta(transaction) {
  const amount = Number(transaction.amount) || 0;
  if (transaction.type === "income") return amount;
  if (transaction.type === "expense") return -amount;
  return 0;
}

export function balanceAt(transactions, openingBalance, date) {
  return openingBalance + transactions
    .filter((transaction) => transaction.date <= date)
    .reduce((sum, transaction) => sum + transactionDelta(transaction), 0);
}

export function buildExpenseByCategory(transactions, bounds) {
  const totals = new Map();
  transactions.filter((transaction) =>
    transaction.type === "expense" && transaction.category && inRange(transaction.date, bounds)
  ).forEach((transaction) => {
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + (Number(transaction.amount) || 0));
  });
  return Array.from(totals, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildIncomeExpenseChart(transactions, filter, bounds) {
  const dates = transactions
    .map((transaction) => transaction.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && inRange(date, bounds))
    .sort();
  if (!dates.length) return [];

  const start = bounds.from || dates[0];
  const end = bounds.to || dates[dates.length - 1];
  if (start > end) return [];

  const daily = filter === "week" || filter === "month" || filter === "lastMonth" ||
    (filter === "custom" && (dateFromISO(end) - dateFromISO(start)) / 86400000 <= 45);
  const grouped = new Map();
  transactions.forEach((transaction) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) || !inRange(transaction.date, bounds)) return;
    const key = daily ? transaction.date : transaction.date.slice(0, 7);
    const values = grouped.get(key) || { income: 0, expense: 0 };
    if (transaction.type === "income" || transaction.type === "expense") {
      values[transaction.type] += Number(transaction.amount) || 0;
    }
    grouped.set(key, values);
  });

  const keys = [];
  if (daily) {
    const cursor = dateFromISO(start);
    const last = dateFromISO(end);
    for (; cursor <= last; cursor.setDate(cursor.getDate() + 1)) keys.push(toISODate(cursor));
  } else {
    const cursor = dateFromISO(`${start.slice(0, 7)}-01`);
    const last = dateFromISO(`${end.slice(0, 7)}-01`);
    for (; cursor <= last; cursor.setMonth(cursor.getMonth() + 1)) keys.push(toISODate(cursor).slice(0, 7));
  }

  return keys.map((key) => ({
    key,
    label: daily ? formatDayMonth(key) : monthLabel(key),
    income: grouped.get(key)?.income || 0,
    expense: grouped.get(key)?.expense || 0,
  }));
}

export function buildBalanceHistory(transactions, openingBalance, bounds, fallbackDate = todayISO()) {
  const ordered = transactions
    .filter((transaction) => /^\d{4}-\d{2}-\d{2}$/.test(transaction.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const start = bounds.from || ordered[0]?.date || fallbackDate;
  const end = bounds.to || ordered[ordered.length - 1]?.date || start;
  if (start > end) {
    return { balanceHistory: [], startingBalance: openingBalance, endingBalance: openingBalance };
  }

  const byDate = new Map();
  let startingBalance = openingBalance;
  let endingBalance = openingBalance;
  ordered.forEach((transaction) => {
    const delta = transactionDelta(transaction);
    if (transaction.date < start) startingBalance += delta;
    if (transaction.date <= end) endingBalance += delta;
    if (transaction.date >= start && transaction.date <= end) {
      byDate.set(transaction.date, (byDate.get(transaction.date) || 0) + delta);
    }
  });

  let running = startingBalance;
  const balanceHistory = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, change]) => {
      running += change;
      return { date, label: formatDayMonth(date), saldo: running };
    });

  return { balanceHistory, startingBalance, endingBalance };
}
