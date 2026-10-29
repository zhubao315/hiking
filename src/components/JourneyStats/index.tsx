import { useMemo, useState } from 'react';
import useActivities from '@/hooks/useActivities';
import { HIKE_TITLES } from '@/utils/const';
import {
  Activity,
  convertMovingTime2Sec,
  MILESTONE_KEYS,
  formatPace,
} from '@/utils/utils';
import styles from './style.module.css';

interface IJourneyStatsProps {
  changeCity: (_city: string) => void;
  changePeriod: (_period: string) => void;
  changeMilestone: (_milestone: string) => void;
}

const PREVIEW_CITIES = 8;

interface RecordRow {
  label: string;
  value: string;
  date: string;
}

interface Records {
  pbRows: RecordRow[];
  prRows: RecordRow[];
}

const fmtDuration = (seconds: number): string => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h, m, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

// 最快时间：用单次徒步的平均速度推算（Strava 口径），走量不足该距离则不计。
const FAST_DISTANCES = [
  { label: '10 公里', meters: 10000 },
  { label: '15 公里', meters: 15000 },
  { label: '20 公里', meters: 20000 },
  { label: '25 公里', meters: 25000 },
];

// 一天里的顺序：清晨 → 午间 → 午后 → 傍晚 → 夜晚；alpha 越小颜色越暗。
const DAY_SEGMENTS = [
  { title: HIKE_TITLES.MORNING_HIKE_TITLE, label: '清晨', alpha: 95 },
  { title: HIKE_TITLES.MIDDAY_HIKE_TITLE, label: '午间', alpha: 76 },
  { title: HIKE_TITLES.AFTERNOON_HIKE_TITLE, label: '午后', alpha: 58 },
  { title: HIKE_TITLES.EVENING_HIKE_TITLE, label: '傍晚', alpha: 44 },
  { title: HIKE_TITLES.NIGHT_HIKE_TITLE, label: '夜晚', alpha: 32 },
];

const fmtKm = (meters: number) =>
  Math.round(meters / 1000).toLocaleString('en-US');

const JourneyStats = ({ changeCity, changePeriod, changeMilestone }: IJourneyStatsProps) => {
  const { activities, years, countries, provinces, cities, runPeriod } =
    useActivities();
  const [expanded, setExpanded] = useState(false);

  const cityArr = useMemo(
    () => Object.entries(cities).sort((a, b) => b[1] - a[1]),
    [cities]
  );

  // 与 YearStat 的 Total 行同一套算法：只统计有配速/心率的记录，缺失不补零。
  let totalMeters = 0;
  let totalSeconds = 0;
  let hrSum = 0;
  let hrCount = 0;
  let streak = 0;
  activities.forEach((run) => {
    if (run.average_speed) {
      totalMeters += run.distance || 0;
      totalSeconds += (run.distance || 0) / run.average_speed;
    }
    if (run.average_heartrate) {
      hrSum += run.average_heartrate;
      hrCount += 1;
    }
    if (run.streak) streak = Math.max(streak, run.streak);
  });
  const avgPace = totalSeconds ? formatPace(totalMeters / totalSeconds) : null;
  const avgHR = hrCount ? Math.round(hrSum / hrCount) : null;

  const periods = DAY_SEGMENTS.map(({ title, label, alpha }) => ({
    title,
    label,
    alpha,
    count: runPeriod[title] || 0,
  }));
  const periodTotal = periods.reduce((sum, p) => sum + p.count, 0);

  // 山野里程碑：单次 ≥20 km 的长线穿越 & 单次累计爬升 ≥1,000 m。
  const milestones = [
    {
      key: MILESTONE_KEYS.LONG_HIKE,
      label: '长线 20K+',
      count: activities.filter((run) => run.distance >= 20000).length,
    },
    {
      key: MILESTONE_KEYS.THOUSAND_CLIMB,
      label: '千米爬升 1000m+',
      count: activities.filter(
        (run) => (run.elevation_gain ?? 0) >= 1000
      ).length,
    },
  ];

  // 个人最佳 / 最快时间：全部由历史数据实时推算，缺失不计、绝不补零。
  const records = useMemo<Records>(() => {
    const empty: Records = { pbRows: [], prRows: [] };
    if (!activities.length) return empty;
    const dateOf = (a: Activity) => a.start_date_local.slice(0, 10);
    const speedKmh = (a: Activity) => (a.average_speed || 0) * 3.6;

    // 均速 < 1.5 km/h 是忘关表/挂表（榜首永远被 9 h 的挂表时长霸占），
    // > 6.5 km/h 是骑行/跑步误标徒步：两种都不计。
    const plausible = activities.filter(
      (a) => a.distance > 0 && speedKmh(a) >= 1.5 && speedKmh(a) <= 6.5
    );
    if (!plausible.length) return empty;

    // 爬升以 3D 地形烘焙值（climb_terrain）为准，无烘焙的用设备记录值兜底。
    // 早年手机 GPS 漂移会把爬升虚高到物理不可能（如爬升 > 2.5×最高到达
    // 海拔；无海拔数据时按单位距离爬升 > 100 m/km 判），这样的爬升值剔除。
    const climbOf = (a: Activity): number => {
      const alt = a.altitude_max;
      const gain = a.climb_terrain || (a.elevation_gain || 0);
      if (!gain) return 0;
      if (alt) return gain <= 2.5 * alt ? gain : 0;
      return gain <= 100 * (a.distance / 1000) ? gain : 0;
    };

    // 「最长时间/最快时间」只取有意义的山野徒步：单次爬升 ≥ 150 m，平原
    // 散步与快走不参与。
    const mountain = plausible.filter((a) => climbOf(a) >= 150);

    const far = plausible.reduce((a, b) =>
      b.distance > a.distance ? b : a
    );
    const longest = mountain.length
      ? mountain.reduce((a, b) =>
          convertMovingTime2Sec(b.moving_time) >
          convertMovingTime2Sec(a.moving_time)
            ? b
            : a
        )
      : null;
    const highestClimb = plausible.reduce((a, b) =>
      climbOf(b) > climbOf(a) ? b : a
    );
    const highestAlt = activities.reduce((a, b) =>
      (b.altitude_max ?? 0) > (a.altitude_max ?? 0) ? b : a
    );

    const pbRows: RecordRow[] = [
      {
        label: '最远距离',
        value: `${(far.distance / 1000).toFixed(2)} km`,
        date: dateOf(far),
      },
      ...(longest
        ? [
            {
              label: '最长时间',
              value: fmtDuration(convertMovingTime2Sec(longest.moving_time)),
              date: dateOf(longest),
            },
          ]
        : []),
      ...(climbOf(highestClimb)
        ? [
            {
              label: '最大爬升',
              value: `${Math.round(climbOf(highestClimb)).toLocaleString('en-US')} m`,
              date: dateOf(highestClimb),
            },
          ]
        : []),
      ...((highestAlt.altitude_max ?? 0) > 0
        ? [
            {
              label: '最高到达海拔',
              value: `${Math.round(highestAlt.altitude_max!).toLocaleString('en-US')} m`,
              date: dateOf(highestAlt),
            },
          ]
        : []),
    ];

    const prRows: RecordRow[] = FAST_DISTANCES.map(({ label, meters }) => {
      const cands = mountain.filter((a) => a.distance >= meters);
      if (!cands.length) return null;
      const best = cands.reduce((a, b) =>
        b.average_speed > a.average_speed ? b : a
      );
      return {
        label,
        value: fmtDuration(meters / best.average_speed),
        date: dateOf(best),
      };
    }).filter((r): r is RecordRow => r !== null);

    return { pbRows, prRows };
  }, [activities]);

  const homeCity = cityArr[0];
  const maxMeters = homeCity ? homeCity[1] : 1;
  const shownCities = expanded ? cityArr : cityArr.slice(0, PREVIEW_CITIES);

  return (
    <section className={styles.journey} aria-label="Total Journey">
      <p className={styles.kicker}>Total Journey</p>

      <div className={styles.geoGrid}>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{years.length}</span>
          <span className={styles.geoLabel}>年</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{countries.length}</span>
          <span className={styles.geoLabel}>国家</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{provinces.length}</span>
          <span className={styles.geoLabel}>省份</span>
        </div>
        <div className={styles.geoCell}>
          <span className={styles.geoValue}>{cityArr.length}</span>
          <span className={styles.geoLabel}>城市</span>
        </div>
        {homeCity ? (
          <button
            type="button"
            className={`${styles.geoCell} ${styles.homeCell}`}
            onClick={() => changeCity(homeCity[0])}
            title="点击在地图上查看主场足迹"
          >
            <span className={styles.geoValue}>{homeCity[0]}</span>
            <span className={styles.geoLabel}>
              {fmtKm(homeCity[1])} KM · 主场
            </span>
          </button>
        ) : null}
      </div>

      <div className={styles.body}>
        {cityArr.length ? (
          <div className={styles.cities}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>城市足迹</span>
              <span className={styles.panelHint}>
                点击城市，在地图上点亮它的轨迹
              </span>
            </div>
            <div
              className={`${styles.cityList} ${
                expanded ? styles.cityListExpanded : ''
              }`}
            >
              {shownCities.map(([name, meters], i) => (
                <button
                  key={name}
                  type="button"
                  className={styles.cityRow}
                  onClick={() => changeCity(name)}
                  title={`${name} · ${fmtKm(meters)} KM`}
                >
                  <span className={styles.cityName}>{name}</span>
                  <span className={styles.cityTrack}>
                    <span
                      className={styles.cityFill}
                      style={{
                        width: `${Math.max(
                          (meters / maxMeters) * 100,
                          0.6
                        )}%`,
                        background: `color-mix(in srgb, var(--accent) ${Math.round(
                          Math.max(
                            0.24,
                            0.95 - (i / Math.max(1, shownCities.length - 1)) * 0.7
                          ) * 100
                        )}%, transparent)`,
                      }}
                    />
                  </span>
                  <span className={styles.cityKm}>{fmtKm(meters)} KM</span>
                </button>
              ))}
            </div>
            {cityArr.length > PREVIEW_CITIES ? (
              <button
                type="button"
                className={styles.toggle}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? '收起' : `展开全部 ${cityArr.length} 城`}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.rhythm}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>时段节律</span>
            <span className={styles.panelHint}>{periodTotal} Hikes</span>
          </div>
          {periodTotal ? (
            <div className={styles.periodBar} role="group" aria-label="时段分布">
              {periods.map((p, i) => (
                <button
                  key={p.title}
                  type="button"
                  className={`${styles.periodSeg} ${
                    i === 0 ? styles.segFirst : ''
                  } ${i === periods.length - 1 ? styles.segLast : ''}`}
                  style={{
                    flexGrow: p.count,
                    background: `color-mix(in srgb, var(--accent) ${p.alpha}%, transparent)`,
                  }}
                  onClick={() => changePeriod(p.title)}
                  title={`${p.label}徒步 · ${p.count} 次`}
                  aria-label={`${p.label} ${p.count} 次`}
                />
              ))}
            </div>
          ) : null}
          <div className={styles.periodLegend}>
            {periods.map((p) => (
              <button
                key={p.title}
                type="button"
                className={styles.legendItem}
                onClick={() => changePeriod(p.title)}
              >
                <span
                  className={styles.legendDot}
                  style={{
                    background: `color-mix(in srgb, var(--accent) ${p.alpha}%, transparent)`,
                  }}
                />
                <span className={styles.legendName}>{p.label}</span>
                <span className={styles.legendCount}>{p.count}</span>
              </button>
            ))}
          </div>

          {milestones.length ? (
            <div className={styles.races}>
              {milestones.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={styles.racePill}
                  onClick={() => changeMilestone(m.key)}
                  title={`查看 ${m.label} 的轨迹`}
                >
                  <span className={styles.raceLabel}>{m.label}</span>
                  <span className={styles.raceCount}>{m.count} Hikes</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.extraKpis}>
            {avgPace ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{avgPace}</span>
                <span className={styles.kpiLabel}>Avg Pace</span>
              </div>
            ) : null}
            {streak ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{streak} day</span>
                <span className={styles.kpiLabel}>Streak</span>
              </div>
            ) : null}
            {avgHR ? (
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{avgHR}</span>
                <span className={styles.kpiLabel}>Avg Heart Rate</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {records.pbRows.length ? (
        <div className={styles.records}>
          <div className={styles.recordCard}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>个人最佳</span>
              <span className={styles.panelHint}>历史之最 · 挂表与误标不计</span>
            </div>
            <div className={styles.recordList}>
              {records.pbRows.map((r) => (
                <div key={r.label} className={styles.recordRow}>
                  <span className={styles.recordLabel}>{r.label}</span>
                  <span className={styles.recordValue}>{r.value}</span>
                  <span className={styles.recordDate}>{r.date}</span>
                </div>
              ))}
            </div>
          </div>
          {records.prRows.length ? (
            <div className={styles.recordCard}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>最快时间</span>
                <span className={styles.panelHint}>按平均速度推算 · 山野徒步</span>
              </div>
              <div className={styles.recordList}>
                {records.prRows.map((r) => (
                  <div key={r.label} className={styles.recordRow}>
                    <span className={styles.recordLabel}>{r.label}</span>
                    <span className={styles.recordValue}>{r.value}</span>
                    <span className={styles.recordDate}>{r.date}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default JourneyStats;
