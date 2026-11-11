import { useMemo } from 'react';
import {
  buildYearSeries,
  computeTotals,
  formatDateCN,
  formatDistanceKm,
  formatNumber,
  type RunRecord,
} from '@/utils/hikingStats';
import styles from './TrainingAnalysis.module.css';

interface IHikingAnalysisProps {
  runs: RunRecord[];
  scopeLabel: string;
}

const axisMonth = (key: string): string => `${Number(key.slice(5, 7))}月`;

interface VolumeBucket {
  key: string;
  axis: string;
  label: string;
  distanceKm: number;
  climbM: number;
  climbCount: number;
  count: number;
}

const buildMonthBuckets = (
  runs: readonly RunRecord[],
  lastDate: string
): VolumeBucket[] => {
  const lastYear = Number(lastDate.slice(0, 4));
  const lastMonth = Number(lastDate.slice(5, 7));
  const buckets: VolumeBucket[] = [];

  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(lastYear, lastMonth - 1 - i, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    buckets.push({
      key: `${year}-${String(month).padStart(2, '0')}`,
      axis: axisMonth(`${year}-${String(month).padStart(2, '0')}`),
      label: `${year} 年 ${month} 月`,
      distanceKm: 0,
      climbM: 0,
      climbCount: 0,
      count: 0,
    });
  }

  const byKey = new Map(
    buckets.map((bucket): [string, VolumeBucket] => [bucket.key, bucket])
  );
  for (const run of runs) {
    const bucket = byKey.get(
      `${run.year}-${String(run.month).padStart(2, '0')}`
    );
    if (!bucket) continue;
    bucket.distanceKm += run.distanceKm;
    bucket.count += 1;
    if (run.climbM !== null) {
      bucket.climbM += run.climbM;
      bucket.climbCount += 1;
    }
  }

  return buckets;
};

const buildYearBuckets = (runs: readonly RunRecord[]): VolumeBucket[] =>
  buildYearSeries(runs).map((point) => {
    const inYear = runs.filter((run) => String(run.year) === String(point.year));
    const climbRuns = inYear.filter((run) => run.climbM !== null);
    return {
      key: String(point.year),
      axis: String(point.year).slice(2),
      label: `${point.year} 年`,
      distanceKm: point.distanceKm,
      climbM: climbRuns.reduce((sum, run) => sum + (run.climbM ?? 0), 0),
      climbCount: climbRuns.length,
      count: point.count,
    };
  });

const bucketTitle = (bucket: VolumeBucket): string =>
  `${bucket.label} · ${formatDistanceKm(bucket.distanceKm)} km · 爬升 +${Math.round(
    bucket.climbM
  )} m（${bucket.climbCount} 条）· ${formatNumber(bucket.count)} 次`;

interface IDualSeriesProps {
  title: string;
  buckets: VolumeBucket[];
  emptyLabel: string;
}

/**
 * Volume (distance) and climb (metres) in one panel: the bars are the
 * distance, the line is the ascent. A period without a hike keeps a baseline
 * stub — no hike is not "zero metres climbed".
 */
const DualSeries = ({ title, buckets, emptyLabel }: IDualSeriesProps) => {
  const maxDistance = buckets.reduce(
    (value, bucket) => Math.max(value, bucket.distanceKm),
    0
  );
  const maxClimb = buckets.reduce(
    (value, bucket) => Math.max(value, bucket.climbM),
    0
  );
  const width = buckets.length * 10;

  const line = buckets
    .map((bucket, index) => {
      const x = index * 10 + 5;
      const y =
        bucket.climbCount > 0 && maxClimb > 0
          ? 100 - (bucket.climbM / maxClimb) * 96
          : 100;
      return `${index ? 'L' : 'M'}${x},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className={styles.seriesCard}>
      <div className={styles.seriesHead}>
        <span className={styles.seriesTitle}>{title}</span>
        <span className={styles.seriesHint}>km · 爬升 m</span>
      </div>
      {buckets.length ? (
        <>
          <svg
            className={styles.seriesSvg}
            viewBox={`0 0 ${width} 100`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title}：柱为里程，折线为累计爬升`}
          >
            {buckets.map((bucket, index) => {
              const height =
                bucket.count > 0 && maxDistance > 0
                  ? Math.max((bucket.distanceKm / maxDistance) * 100, 2)
                  : 0;
              const x = index * 10 + 1;
              if (!height) {
                return (
                  <rect
                    key={bucket.key}
                    className={styles.stub}
                    x={x}
                    y={99}
                    width={8}
                    height={1}
                    fill="currentColor"
                  >
                    <title>{bucketTitle(bucket)}</title>
                  </rect>
                );
              }
              return (
                <rect
                  key={bucket.key}
                  className={styles.bar}
                  x={x}
                  y={100 - height}
                  width={8}
                  height={height}
                  fill="currentColor"
                  fillOpacity={0.45}
                >
                  <title>{bucketTitle(bucket)}</title>
                </rect>
              );
            })}
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div
            className={styles.seriesAxis}
            style={{
              gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`,
            }}
          >
            {buckets.map((bucket) => (
              <span key={bucket.key}>{bucket.axis}</span>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.chartEmpty}>{emptyLabel}</p>
      )}
    </div>
  );
};

/* -------------------------------------------------- terrain difficulty */

interface IGradeBin {
  key: string;
  label: string;
  range: string;
  min: number;
  max: number;
}

const GRADE_BINS: IGradeBin[] = [
  {
    key: 'easy',
    label: '平缓步道',
    range: '< 30 m/km',
    min: 0,
    max: 30,
  },
  {
    key: 'medium',
    label: '常规山野',
    range: '30–60 m/km',
    min: 30,
    max: 60,
  },
  {
    key: 'steep',
    label: '陡峭攀升',
    range: '> 60 m/km',
    min: 60,
    max: Infinity,
  },
];

const binOf = (grade: number): IGradeBin =>
  GRADE_BINS.find((bin) => grade >= bin.min && grade < bin.max) ??
  GRADE_BINS[GRADE_BINS.length - 1];

const HikingAnalysis = ({ runs, scopeLabel }: IHikingAnalysisProps) => {
  const totals = useMemo(() => computeTotals(runs), [runs]);

  const volumes = useMemo(() => {
    if (!totals.lastDate) {
      return { months: [], years: [] };
    }
    return {
      months: buildMonthBuckets(runs, totals.lastDate),
      years: buildYearBuckets(runs),
    };
  }, [runs, totals.lastDate]);

  const grades = useMemo(() => {
    // Only hikes that carry a usable ascent figure can be graded; the others
    // stay out of the denominator instead of counting as flat.
    const graded = runs.filter(
      (run) => run.climbM !== null && run.distanceKm > 0
    );
    const bins = GRADE_BINS.map((bin) => {
      const inBin = graded.filter(
        (run) => binOf(run.climbM! / run.distanceKm).key === bin.key
      );
      return {
        ...bin,
        count: inBin.length,
        distanceKm: inBin.reduce((sum, run) => sum + run.distanceKm, 0),
        climbM: inBin.reduce((sum, run) => sum + (run.climbM ?? 0), 0),
      };
    });
    return { graded, bins };
  }, [runs]);

  const climbShare = totals.count
    ? Math.round((totals.climbCount / totals.count) * 100)
    : 0;

  if (!runs.length) {
    return (
      <p className={styles.emptyState}>
        {scopeLabel} 范围内没有徒步记录，训练分析暂无数据。
      </p>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.caption}>
        <span className={styles.captionScope}>{scopeLabel}</span>
        <span>
          {formatNumber(totals.count)} 次 ·{' '}
          {formatDateCN(totals.firstDate as string)} →{' '}
          {formatDateCN(totals.lastDate as string)}
        </span>
      </p>

      <div className={styles.volumeGrid}>
        <DualSeries
          title="近 12 个月"
          buckets={volumes.months}
          emptyLabel="暂无月数据"
        />
        <DualSeries
          title="历年徒步"
          buckets={volumes.years}
          emptyLabel="暂无年度数据"
        />
      </div>
      <p className={styles.note}>
        柱为里程（km），折线为该周期的累计爬升（m）；悬停可看两者与次数。没有徒步的
        月/年只保留基线短标记，不补造里程或爬升。
      </p>

      <div className={styles.frequencyGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>累计徒步里程</span>
          <p className={styles.statValue}>
            {formatDistanceKm(totals.distanceKm)}
            <span className={styles.statUnit}>km</span>
          </p>
          <p className={styles.statSub}>
            {formatNumber(totals.count)} 次徒步 · 区间含首尾
          </p>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>累计可信爬升</span>
          <p className={styles.statValue}>
            {totals.climbM === null ? '—' : Math.round(totals.climbM)}
            <span className={styles.statUnit}>m</span>
          </p>
          <p className={styles.statSub}>
            {formatNumber(totals.climbCount)} / {formatNumber(totals.count)} 条
            有爬升数据（{climbShare}%）
          </p>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>最高到达点</span>
          <p className={styles.statValue}>
            {totals.altitudeMaxM === null ? '—' : Math.round(totals.altitudeMaxM)}
            <span className={styles.statUnit}>m</span>
          </p>
          <p className={styles.statSub}>来自烘焙地形的高程</p>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>山野活跃天数</span>
          <p className={styles.statValue}>
            {formatNumber(totals.aliveCount)}
            <span className={styles.statUnit}>天</span>
          </p>
          <p className={styles.statSub}>有徒步记录的日历天数</p>
        </div>
      </div>

      <div className={styles.hrPanel}>
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>山野强度矩阵</span>
          <span className={styles.panelHint}>每公里爬升强度</span>
        </div>
        {grades.graded.length ? (
          <>
            <div className={styles.zoneRows}>
              {grades.bins.map((bin) => {
                const share = grades.graded.length
                  ? bin.count / grades.graded.length
                  : 0;
                return (
                  <div key={bin.key} className={styles.zoneRow}>
                    <span className={styles.zoneName}>{bin.label}</span>
                    <span className={styles.zoneRange}>{bin.range}</span>
                    <span className={styles.zoneTrack}>
                      <span
                        className={styles.zoneFill}
                        style={{
                          width: share
                            ? `${Math.max(share * 100, 2)}%`
                            : '0',
                          background:
                            'color-mix(in srgb, var(--accent) 46%, transparent)',
                        }}
                      />
                    </span>
                    <span className={styles.zoneCount}>
                      {formatNumber(bin.count)} 次 ·{' '}
                      {Math.round(share * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={styles.levelGrid}>
              {grades.bins.map((bin) => (
                <div key={bin.key} className={styles.levelItem}>
                  <span className={styles.levelSwatch} />
                  <span className={styles.levelLabel}>
                    {bin.label} {bin.range}
                  </span>
                  <strong className={styles.levelPct}>
                    {formatDistanceKm(bin.distanceKm)}
                  </strong>
                  <span className={styles.levelCount}>
                    爬升 +{Math.round(bin.climbM)} m
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className={styles.hrEmpty}>
            当前范围内没有带爬升数据的徒步，强度矩阵暂无内容。
          </p>
        )}
        <p className={styles.note}>
          强度 = 爬升 ÷ 距离（m/km）。只统计 {formatNumber(grades.graded.length)}{' '}
          条带可信爬升的徒步；没有爬升数据的记录既不计入分母，也不按平缓处理。
        </p>
      </div>
    </div>
  );
};

export default HikingAnalysis;
