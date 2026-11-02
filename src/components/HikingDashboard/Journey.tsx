import { useMemo } from 'react';
import SectionHeader from './SectionHeader';
import {
  buildMilestones,
  buildPeriods,
  buildSeasons,
  computeGeo,
  computeRecords,
  computeTotals,
  formatAltitude,
  formatClimb,
  formatDistanceKm,
  formatDurationLong,
  formatNumber,
  type RunRecord,
} from '@/utils/hikingStats';
import styles from './style.module.css';

interface IJourneyProps {
  runs: RunRecord[];
  onSelectRun: (_runId: number) => void;
  onSelectProvince: (_name: string) => void;
  onSelectSeason: (_key: string) => void;
  onSelectPeriod: (_key: string) => void;
  onSelectMilestone: (_key: string) => void;
}

const Journey = ({
  runs,
  onSelectRun,
  onSelectProvince,
  onSelectSeason,
  onSelectPeriod,
  onSelectMilestone,
}: IJourneyProps) => {
  const totals = useMemo(() => computeTotals(runs), [runs]);
  const records = useMemo(() => computeRecords(runs), [runs]);
  const geo = useMemo(() => computeGeo(runs), [runs]);
  const seasons = useMemo(() => buildSeasons(runs), [runs]);
  const periods = useMemo(() => buildPeriods(runs), [runs]);
  const milestones = useMemo(() => buildMilestones(runs), [runs]);

  const firstYear = totals.firstDate?.slice(0, 4) ?? '';
  const lastYear = totals.lastDate?.slice(0, 4) ?? '';
  const seasonMax = Math.max(1, ...seasons.map((item) => item.count));
  const periodMax = Math.max(1, ...periods.map((item) => item.count));
  const geoPercent = Math.round(geo.coverage * 100);

  return (
    <section className={styles.section} aria-labelledby="journey-title">
      <SectionHeader index="04" kicker="TOTAL JOURNEY" title="徒步旅程">
        <span className={styles.scopePill}>
          {firstYear && lastYear ? `${firstYear}—${lastYear} · ` : ''}
          {formatNumber(totals.count)} 次
        </span>
      </SectionHeader>

      <div className={styles.journeyGrid}>
        <div className={styles.journeyBlock}>
          <h3 className={styles.blockTitle}>征程概要</h3>
          <dl className={styles.journeyFacts}>
            <div>
              <dt>总里程</dt>
              <dd>{formatDistanceKm(totals.distanceKm)} km</dd>
            </div>
            <div>
              <dt>总时长</dt>
              <dd>{formatDurationLong(totals.seconds)}</dd>
            </div>
            <div>
              <dt>累计爬升</dt>
              <dd>{formatClimb(totals.climbM)}</dd>
            </div>
            <div>
              <dt>最高到达</dt>
              <dd>{formatAltitude(totals.altitudeMaxM)}</dd>
            </div>
            <div>
              <dt>徒步活跃日</dt>
              <dd>{formatNumber(totals.activeDays)} 天</dd>
            </div>
            <div>
              <dt>最长连续</dt>
              <dd>{formatNumber(totals.longestStreak)} 天</dd>
            </div>
          </dl>
        </div>

        <div className={styles.journeyBlock}>
          <h3 className={styles.blockTitle}>代表性徒步</h3>
          {records.length ? (
            <ul className={styles.recordList}>
              {records.map((row) => (
                <li key={row.label}>
                  <button
                    type="button"
                    className={styles.recordRow}
                    onClick={() => onSelectRun(row.runId)}
                  >
                    <span className={styles.recordMain}>
                      <span className={styles.recordLabel}>{row.label}</span>
                      <span className={styles.recordDate}>{row.date}</span>
                    </span>
                    <span className={styles.recordValue}>{row.value}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.blockNote}>暂无可用的代表性记录。</p>
          )}
        </div>

        <div className={styles.journeyBlock}>
          <h3 className={styles.blockTitle}>地理足迹</h3>
          <p className={styles.blockNote}>
            仅 {formatNumber(geo.locatedCount)} / {formatNumber(totals.count)}{' '}
            条记录带结构化地点（{geoPercent}
            %），按记录原文归类，从未根据坐标推断地名。
          </p>
          {geo.provinces.length ? (
            <ul className={styles.geoList}>
              {geo.provinces.map((row) => (
                <li key={row.name}>
                  <button
                    type="button"
                    className={styles.geoRow}
                    onClick={() => onSelectProvince(row.name)}
                  >
                    <span className={styles.geoName}>{row.name}</span>
                    <span className={styles.geoMeta}>
                      {formatNumber(row.count)} 次 ·{' '}
                      {formatDistanceKm(row.distanceKm)} km
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.blockNote}>没有可识别的省级地点记录。</p>
          )}
          {geo.cities.length ? (
            <p className={styles.geoCities}>
              城市：
              {geo.cities
                .slice(0, 6)
                .map((row) => `${row.name}（${formatNumber(row.count)}）`)
                .join(' · ')}
            </p>
          ) : null}
        </div>

        <div className={styles.journeyBlock}>
          <h3 className={styles.blockTitle}>季节分布</h3>
          <ul className={styles.barList}>
            {seasons.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  className={styles.barRow}
                  onClick={() => onSelectSeason(row.key)}
                >
                  <span className={styles.barName}>
                    {row.label}
                    <em>{row.months}</em>
                  </span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{ width: `${(row.count / seasonMax) * 100}%` }}
                    />
                  </span>
                  <span className={styles.barCount}>
                    {formatNumber(row.count)} 次
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.journeyBlock}>
          <h3 className={styles.blockTitle}>出发时段</h3>
          <ul className={styles.barList}>
            {periods.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  className={styles.barRow}
                  onClick={() => onSelectPeriod(row.key)}
                >
                  <span className={styles.barName}>
                    {row.label}
                    <em>{row.en}</em>
                  </span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{ width: `${(row.count / periodMax) * 100}%` }}
                    />
                  </span>
                  <span className={styles.barCount}>
                    {formatNumber(row.count)} 次
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.journeyBlock}>
          <h3 className={styles.blockTitle}>山野里程碑</h3>
          <div className={styles.chipRow}>
            {milestones.map((row) => (
              <button
                key={row.key}
                type="button"
                className={styles.milestoneChip}
                onClick={() => onSelectMilestone(row.key)}
              >
                <span className={styles.milestoneLabel}>{row.label}</span>
                <span className={styles.milestoneEn}>{row.en}</span>
                <strong className={styles.milestoneCount}>
                  {formatNumber(row.count)} 次
                </strong>
              </button>
            ))}
          </div>
          <p className={styles.blockNote}>
            长线按单次里程 ≥ 20 km 计；千米爬升按单次可信爬升 ≥ 1000 m 计。点击可筛选全部记录。
          </p>
        </div>
      </div>
    </section>
  );
};

export default Journey;
