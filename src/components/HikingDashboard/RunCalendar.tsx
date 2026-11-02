import SectionHeader from './SectionHeader';
import {
  WEEKDAYS,
  calendarLevel,
  formatClimb,
  formatDistanceKm,
  formatMonthCN,
  formatNumber,
  type CalendarYear,
} from '@/utils/hikingStats';
import styles from './style.module.css';

export type CalendarMetric = 'distance' | 'elevation';

interface IRunCalendarProps {
  calendar: CalendarYear;
  metric: CalendarMetric;
  selectedMonth: number | null;
  selectedDate: string | null;
  minYear: number;
  maxYear: number;
  onSelectMonth: (_year: number, _month: number) => void;
  onSelectDate: (_date: string) => void;
  onSelectYear: (_year: string) => void;
  onSelectMetric: (_metric: CalendarMetric) => void;
}

const pad = (value: number) => String(value).padStart(2, '0');
const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const RunCalendar = ({
  calendar,
  metric,
  selectedMonth,
  selectedDate,
  minYear,
  maxYear,
  onSelectMonth,
  onSelectDate,
  onSelectYear,
  onSelectMetric,
}: IRunCalendarProps) => {
  const today = todayString();
  const canPrev = calendar.year > minYear;
  const canNext = calendar.year < maxYear;
  const byElevation = metric === 'elevation';

  return (
    <section className={styles.section} aria-labelledby="calendar-title">
      <SectionHeader index="06" kicker="HIKING CALENDAR" title="徒步日历">
        <div className={styles.yearNav}>
          <button
            type="button"
            className={styles.yearNavButton}
            onClick={() => onSelectYear(String(calendar.year - 1))}
            disabled={!canPrev}
            aria-label="上一年"
          >
            ‹
          </button>
          <span className={styles.yearNavLabel}>
            {calendar.year}
            <span>年</span>
          </span>
          <button
            type="button"
            className={styles.yearNavButton}
            onClick={() => onSelectYear(String(calendar.year + 1))}
            disabled={!canNext}
            aria-label="下一年"
          >
            ›
          </button>
          <button
            type="button"
            className={`${styles.yearAllButton} ${
              selectedMonth || selectedDate ? styles.yearAllButtonActive : ''
            }`}
            onClick={() => onSelectYear(String(calendar.year))}
          >
            全年
          </button>
        </div>
      </SectionHeader>

      <div className={styles.calendarMeta}>
        <div className={styles.metricTabs} role="group" aria-label="日历着色指标">
          <button
            type="button"
            className={`${styles.metricTab} ${
              byElevation ? '' : styles.metricTabActive
            }`}
            onClick={() => onSelectMetric('distance')}
            aria-pressed={!byElevation}
          >
            里程
          </button>
          <button
            type="button"
            className={`${styles.metricTab} ${
              byElevation ? styles.metricTabActive : ''
            }`}
            onClick={() => onSelectMetric('elevation')}
            aria-pressed={byElevation}
          >
            爬升
          </button>
        </div>
        <span>
          {formatNumber(calendar.totals.count)} 次 ·{' '}
          {formatDistanceKm(calendar.totals.distanceKm)} km
          {byElevation
            ? ` · 爬升 ${formatClimb(calendar.totals.climbM)}`
            : ''}
        </span>
        <span className={styles.calendarHint}>
          {byElevation
            ? '按当日累计爬升着色 · 没有爬升记录的日期不着色 · 圆点表示一天多次'
            : '按当日总里程着色 · 圆点表示一天多次'}
        </span>
      </div>

      <div className={styles.months}>
        {calendar.months.map((month) => {
          const isActive = selectedMonth === month.month;
          const monthValue = byElevation
            ? formatClimb(month.climbM)
            : `${formatDistanceKm(month.distanceKm)} km`;
          return (
            <div
              key={month.month}
              className={`${styles.month} ${isActive ? styles.monthActive : ''}`}
            >
              <button
                type="button"
                className={styles.monthHead}
                onClick={() => onSelectMonth(calendar.year, month.month)}
                aria-pressed={isActive}
                title={`${formatMonthCN(month.month)} · ${formatNumber(
                  month.count
                )} 次 · ${monthValue}`}
              >
                <span className={styles.monthName}>
                  {formatMonthCN(month.month)}
                </span>
                <span className={styles.monthMeta}>
                  {month.count ? monthValue : '无记录'}
                </span>
              </button>

              <div className={styles.weekdays} aria-hidden="true">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className={styles.days}>
                {month.cells.map((cell, index) => {
                  if (!cell) {
                    return (
                      <span
                        key={`blank-${index}`}
                        className={styles.dayBlank}
                        aria-hidden="true"
                      />
                    );
                  }
                  if (!cell.count) {
                    return (
                      <span
                        key={cell.date}
                        className={`${styles.day} ${styles.dayEmpty}`}
                        title={`${cell.date} · 无记录`}
                      >
                        {cell.day}
                      </span>
                    );
                  }
                  const selected = selectedDate === cell.date;
                  const raw = byElevation ? cell.climbM : cell.distanceKm;
                  const level = calendarLevel(raw, metric);
                  const detail = byElevation
                    ? `${cell.climbM === null ? '无爬升数据' : formatClimb(cell.climbM)}`
                    : `${formatDistanceKm(cell.distanceKm)} 公里`;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      className={`${styles.day} ${
                        level ? styles[`dayLevel${level}`] : ''
                      } ${selected ? styles.daySelected : ''} ${
                        cell.date === today ? styles.dayToday : ''
                      }`}
                      onClick={() => onSelectDate(cell.date)}
                      aria-pressed={selected}
                      aria-label={`${cell.date}，${detail}，${cell.count} 次`}
                      title={`${cell.date} · ${detail} · ${cell.count} 次`}
                    >
                      {cell.day}
                      {cell.count > 1 ? (
                        <i className={styles.multiDot} aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendLabel}>少</span>
        <span className={`${styles.legendSwatch} ${styles.dayLevel1}`} />
        <span className={`${styles.legendSwatch} ${styles.dayLevel2}`} />
        <span className={`${styles.legendSwatch} ${styles.dayLevel3}`} />
        <span className={`${styles.legendSwatch} ${styles.dayLevel4}`} />
        <span className={`${styles.legendSwatch} ${styles.dayLevel5}`} />
        <span className={styles.legendLabel}>多</span>
        <span className={`${styles.legendSwatch} ${styles.legendEmpty}`} />
        <span className={styles.legendLabel}>无记录</span>
      </div>

      <p className={styles.sectionNote}>
        {byElevation
          ? '爬到多高算「多」按当日累计爬升分档：80 / 250 / 500 / 900 / 1400 m。缺少爬升数据的日期保持空白，不以 0 着色。'
          : '里程分档：3 / 6 / 10 / 15 / 22 km。点击日期可展开当天每一次徒步。'}
      </p>
    </section>
  );
};

export default RunCalendar;
