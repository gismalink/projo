type CompanyLoadCardProps = {
  t: Record<string, string>;
  companyDailyLoad: { totals: number[]; max: number };
  companyLoadScaleMax: number;
  todayPosition: string | null;
  dayStep: string;
  dayMarkers: Array<{ key: string; left: string; label: string }>;
  months: string[];
  selectedYear: number;
};

export function CompanyLoadCard(props: CompanyLoadCardProps) {
  const { t, companyDailyLoad, companyLoadScaleMax, todayPosition, dayStep, dayMarkers, months, selectedYear } = props;

  return (
    <section className="company-load-card">
      <div className="section-header">
        <h3>{t.companyLoad}</h3>
        <span className="muted">max {companyDailyLoad.max.toFixed(0)}%</span>
      </div>
      <div className="company-load-chart">
        <span className="company-load-grid-line company-load-grid-line-limit" style={{ bottom: `${(100 / companyLoadScaleMax) * 100}%` }} />
        {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
        {companyDailyLoad.totals.map((value, index) => (
          <span
            key={`${selectedYear}-load-${index}`}
            className={value > 100 ? 'company-load-bar overloaded' : 'company-load-bar'}
            style={{ height: `${Math.max(2, (value / companyLoadScaleMax) * 100)}%` }}
            title={`Day ${index + 1}: ${value.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="day-grid" style={{ ['--day-step' as string]: dayStep }}>
        {todayPosition ? <span className="current-day-line" style={{ left: todayPosition }} /> : null}
        {dayMarkers.map((marker) => (
          <span key={marker.key} className="day-marker" style={{ left: marker.left }}>
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