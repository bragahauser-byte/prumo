export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export type RecurringSchedule = {
  frequency: RecurringFrequency;
  startsOn: string;
  dueDay: number | null;
  endsOn?: string | null;
};

function parseCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError("Invalid calendar date.");
  }
  return date;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clampedDate(year: number, month: number, dueDay: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(dueDay, lastDay)));
}

export function generateOccurrenceDates(schedule: RecurringSchedule, throughDate: string, fromDate = schedule.startsOn) {
  const start = parseCalendarDate(schedule.startsOn);
  const requestedStart = parseCalendarDate(fromDate);
  const end = parseCalendarDate(throughDate);
  const configuredEnd = schedule.endsOn ? parseCalendarDate(schedule.endsOn) : end;
  const limit = configuredEnd < end ? configuredEnd : end;
  const windowStart = requestedStart > start ? requestedStart : start;
  if (windowStart > limit) return [];

  if (schedule.frequency === "weekly") {
    const dates: string[] = [];
    const occurrence = new Date(start);
    if (occurrence < windowStart) {
      const weeksToSkip = Math.ceil((windowStart.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      occurrence.setUTCDate(occurrence.getUTCDate() + weeksToSkip * 7);
    }
    while (occurrence <= limit) {
      dates.push(formatDate(occurrence));
      occurrence.setUTCDate(occurrence.getUTCDate() + 7);
    }
    return dates;
  }

  if (!schedule.dueDay || schedule.dueDay < 1 || schedule.dueDay > 31) {
    throw new RangeError("Monthly and yearly schedules require a due day from 1 to 31.");
  }

  const dates: string[] = [];
  if (schedule.frequency === "monthly") {
    const cursor = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), 1));
    while (cursor <= limit) {
      const occurrence = clampedDate(cursor.getUTCFullYear(), cursor.getUTCMonth(), schedule.dueDay);
      if (occurrence >= windowStart && occurrence <= limit) dates.push(formatDate(occurrence));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return dates;
  }

  for (let year = windowStart.getUTCFullYear(); year <= limit.getUTCFullYear(); year += 1) {
    const occurrence = clampedDate(year, start.getUTCMonth(), schedule.dueDay);
    if (occurrence >= windowStart && occurrence <= limit) dates.push(formatDate(occurrence));
  }
  return dates;
}
