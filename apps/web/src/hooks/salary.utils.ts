export function parseSalaryInput(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export function monthlyToHourly(monthlySalary: number, monthlyHours: number): number {
  return Number((monthlySalary / monthlyHours).toFixed(2));
}
