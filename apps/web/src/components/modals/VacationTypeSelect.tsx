type VacationTypeSelectProps = {
  t: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
};

export function VacationTypeSelect({ t, value, onChange }: VacationTypeSelectProps) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="vacation">{t.vacationTypeVacation}</option>
      <option value="sick">{t.vacationTypeSick}</option>
      <option value="day_off">{t.vacationTypeDayOff}</option>
    </select>
  );
}
