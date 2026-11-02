import { useMemo } from 'react';
import SectionHeader from './SectionHeader';
import {
  formatDistanceKm,
  formatDurationLong,
  formatNumber,
  type RunRecord,
  type Totals,
} from '@/utils/hikingStats';
import styles from './style.module.css';

interface ICoreMetricsProps {
  totals: Totals;
  scope: string;
  runs?: RunRecord[];
}

const CoreMetrics = ({ totals, scope, runs = [] }: ICoreMetricsProps) => {
  const hasRuns = totals.count > 0;
  const climbCoverage = totals.count
    ? Math.round((totals.climbCount / totals.count) * 100)
    : 0;
  const altitudeCoverage = totals.count
    ? Math.round((totals.aliveCount / totals.count) * 100)
    : 0;

  const longestKm = useMemo(
    () =>
      runs.length ? Math.max(...runs.map((run) => run.distanceKm)) : null,
    [runs]
  );

  const items = [
    {
      label: '累计徒步里程',
      value: formatDistanceKm(totals.distanceKm),
      unit: 'km',
      sub: hasRuns
        ? `${formatNumber(totals.count)} 次 · 平均 ${formatDistanceKm(
            totals.averageDistanceKm
          )} km`
        : '当前范围没有记录',
    },
    {
      label: '累计徒步时长',
      value: formatDurationLong(hasRuns ? totals.seconds : null),
      unit: '',
      sub: hasRuns
        ? `平均每次 ${formatDurationLong(totals.averageSeconds)}`
        : '当前范围没有记录',
    },
    {
      label: '累计爬升',
      value:
        totals.climbM === null ? '—' : formatNumber(Math.round(totals.climbM)),
      unit: totals.climbM === null ? '' : 'm',
      sub: hasRuns
        ? totals.climbCount
          ? `覆盖 ${formatNumber(totals.climbCount)} / ${formatNumber(
              totals.count
            )} 次（${climbCoverage}%）`
          : '当前范围没有爬升记录'
        : '当前范围没有记录',
    },
    {
      label: '最高到达海拔',
      value:
        totals.altitudeMaxM === null
          ? '—'
          : formatNumber(Math.round(totals.altitudeMaxM)),
      unit: totals.altitudeMaxM === null ? '' : 'm',
      sub: hasRuns
        ? totals.aliveCount
          ? `覆盖 ${formatNumber(totals.aliveCount)} / ${formatNumber(
              totals.count
            )} 次（${altitudeCoverage}%）`
          : '当前范围没有海拔记录'
        : '当前范围没有记录',
    },
  ];

  return (
    <section className={styles.core} aria-labelledby="core-title">
      <SectionHeader index="02" kicker="CORE METRICS" title="核心徒步数据">
        <span className={styles.scopePill}>{scope}</span>
      </SectionHeader>

      <div className={styles.metricsGrid}>
        {items.map((item) => (
          <article key={item.label} className={styles.metricCard}>
            <span className={styles.metricLabel}>{item.label}</span>
            <p className={styles.metricValue}>
              {item.value}
              {item.unit ? (
                <span className={styles.metricUnit}>{item.unit}</span>
              ) : null}
            </p>
            <p className={styles.metricSub}>{item.sub}</p>
          </article>
        ))}
      </div>

      <p className={styles.metricNote}>
        {hasRuns
          ? `累计爬升按单次徒步累加，与「最高到达海拔」是两个独立概念。${
              longestKm !== null
                ? ` 最长单次 ${formatDistanceKm(longestKm)} km。`
                : ''
            }`
          : '当前范围没有记录。'}
        {totals.climbCount > 0
          ? ` 爬升覆盖 ${formatNumber(totals.climbCount)} / ${formatNumber(
              totals.count
            )} 次（${climbCoverage}%），未覆盖的年份显示「—」，不以 0 代替；GPS 噪声导致的物理不可能值（>2.5 × 最高海拔，或无海拔数据时 >100 m/km）视为缺失，原始记录不改动。`
          : ''}
        {totals.altitudeMaxM !== null
          ? ' 海拔来自 3D 地形剖面回填，仅覆盖有剖面数据的徒步。'
          : ''}
        {' 徒步数据不含功率、踏频或热量字段，这些指标不展示。'}
      </p>
    </section>
  );
};

export default CoreMetrics;
