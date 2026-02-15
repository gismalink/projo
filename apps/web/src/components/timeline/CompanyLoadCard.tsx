type CompanyLoadCardProps = {
  t: Record<string, string>;
  companyLoad: { values: number[]; max: number };
  companyLoadScaleMax: number;
  todayPosition: string | null;
  dragStepDays: 1 | 7 | 30;
  dayStep: string;
  dayMarkers: Array<{ key: string; left: string; label: string; title?: string }>;
  calendarSegments: Array<{ key: string; left: string; width: string; kind: 'weekend' | 'holiday' }>;
  months: string[];
  selectedYear: number;
};

export function CompanyLoadCard(props: CompanyLoadCardProps) {
  const { t, companyLoad, companyLoadScaleMax, todayPosition, dragStepDays, dayStep, dayMarkers, calendarSegments, months, selectedYear } = props;

  return (
    <section className="company-load-card">
      <div className="section-header">
        <h3>{t.companyLoad}</h3>
        <span className="muted">max {companyLoad.max.toFixed(0)}%</span>
      </div>
      <div className="company-load-chart">
        {calendarSegments.map((segment) => (
          <span
            key={`chart-${segment.key}`}
            className={`calendar-day-segment ${segment.kind === 'holiday' ? 'holiday' : 'weekend'}`}
            style={{ left: segment.left, width: segment.width }}
          />
        ))}
        <span className="company-load-grid-line company-load-grid-line-limit" style={{ bottom: `${(100 / companyLoadScaleMax) * 100}%` }} />
        {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
        {companyLoad.values.map((value, index) => {
          const unitLabel =
            dragStepDays === 30 ? (months[index] ?? `Month ${index + 1}`) : dragStepDays === 7 ? `Week ${index + 1}` : `Day ${index + 1}`;
          return (
            <span
              key={`${selectedYear}-load-${index}`}
              className={value > 100 ? 'company-load-bar overloaded' : 'company-load-bar'}
              style={{ height: `${Math.max(2, (value / companyLoadScaleMax) * 100)}%` }}
              title={`${unitLabel}: ${value.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <div className="day-grid" style={{ ['--day-step' as string]: dayStep }}>
        {calendarSegments.map((segment) => (
          <span
            key={`day-${segment.key}`}
            className={`calendar-day-segment ${segment.kind === 'holiday' ? 'holiday' : 'weekend'}`}
            style={{ left: segment.left, width: segment.width }}
          />
        ))}
        {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
        {dayMarkers.map((marker) => (
          <span key={marker.key} className="day-marker" style={{ left: marker.left }} title={marker.title}>
            {marker.label}
          </span>
        ))}
      </div>
      <div className="month-grid">
        {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
        {months.map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>
    </section>
  );
}