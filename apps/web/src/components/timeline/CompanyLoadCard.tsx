type CompanyLoadCardProps = {
  t: Record<string, string>;
  title: string;
  companyLoad: {
    values: number[];
    bars: Array<{ left: string; width: string; value: number; label: string }>;
    max: number;
    avg: number;
  };
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
  const { t, title, companyLoad, companyLoadScaleMax, todayPosition, dragStepDays, dayStep, dayMarkers, calendarSegments, months, selectedYear } = props;

  return (
    <section className="company-load-card">
      <div className="section-header">
        <h3>{title}</h3>
        <span className="muted">avg {companyLoad.avg.toFixed(1)}% · max {companyLoad.max.toFixed(1)}%</span>
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
        {companyLoad.bars.map((bar, index) => {
          const value = bar.value;
          const barHeightPercent = value > 0 ? Math.max(2, (value / companyLoadScaleMax) * 100) : 0;
          return (
            <span
              key={`${selectedYear}-load-${index}`}
              className={value > 100 ? 'company-load-bar positioned overloaded' : 'company-load-bar positioned'}
              style={{
                left: bar.left,
                width: bar.width,
                height: `${barHeightPercent}%`,
              }}
              title={`${bar.label}: ${value.toFixed(1)}%`}
            />
          );
        })}
        {calendarSegments.map((segment) => (
          <span
            key={`chart-overlay-${segment.key}`}
            className={`calendar-day-segment company-chart-overlay ${segment.kind === 'holiday' ? 'holiday' : 'weekend'}`}
            style={{ left: segment.left, width: segment.width }}
          />
        ))}
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