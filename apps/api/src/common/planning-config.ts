const parsedStandardDayHours = Number(process.env.STANDARD_DAY_HOURS ?? 8);

export const STANDARD_DAY_HOURS = Number.isFinite(parsedStandardDayHours) && parsedStandardDayHours > 0
  ? parsedStandardDayHours
  : 8;
