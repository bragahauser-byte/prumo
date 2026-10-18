export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export type RecurringSchedule = {
  frequency: RecurringFrequency;
  startsOn: string;
  dueDay: number | null;
  endsOn?: string | null;
  /** Repete a cada N semanas, meses ou anos. Padrão: 1. */
  interval?: number;
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
  const interval = schedule.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 12) {
    throw new RangeError("Interval must be an integer from 1 to 12.");
  }
  if (windowStart > limit) return [];

  if (schedule.frequency === "weekly") {
    const dates: string[] = [];
    const stepDays = 7 * interval;
    const occurrence = new Date(start);
    if (occurrence < windowStart) {
      const periodsToSkip = Math.ceil((windowStart.getTime() - start.getTime()) / (stepDays * 24 * 60 * 60 * 1000));
      occurrence.setUTCDate(occurrence.getUTCDate() + periodsToSkip * stepDays);
    }
    while (occurrence <= limit) {
      dates.push(formatDate(occurrence));
      occurrence.setUTCDate(occurrence.getUTCDate() + stepDays);
    }
    return dates;
  }

  if (!schedule.dueDay || schedule.dueDay < 1 || schedule.dueDay > 31) {
    throw new RangeError("Monthly and yearly schedules require a due day from 1 to 31.");
  }

  const dates: string[] = [];
  if (schedule.frequency === "monthly") {
    const startIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
    const windowIndex = windowStart.getUTCFullYear() * 12 + windowStart.getUTCMonth();
    let index = startIndex + Math.max(0, Math.floor((windowIndex - startIndex) / interval)) * interval;
    while (index <= limit.getUTCFullYear() * 12 + limit.getUTCMonth()) {
      const occurrence = clampedDate(Math.floor(index / 12), index % 12, schedule.dueDay);
      if (occurrence >= windowStart && occurrence <= limit) dates.push(formatDate(occurrence));
      index += interval;
    }
    return dates;
  }

  const startYear = start.getUTCFullYear();
  let year = startYear + Math.max(0, Math.floor((windowStart.getUTCFullYear() - startYear) / interval)) * interval;
  for (; year <= limit.getUTCFullYear(); year += interval) {
    const occurrence = clampedDate(year, start.getUTCMonth(), schedule.dueDay);
    if (occurrence >= windowStart && occurrence <= limit) dates.push(formatDate(occurrence));
  }
  return dates;
}
