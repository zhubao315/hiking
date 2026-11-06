import { HIKE_TITLES } from '@/utils/const';
import {
  Activity,
  MILESTONE_KEYS,
  convertMovingTime2Sec,
  periodTitleForRun,
} from '@/utils/utils';

/**
 * Single source of truth for every number on the hiking dashboard.
 *
 * Rules (mirrored from JourneyStats, which is the reference for record
 * integrity on this site):
 * - only `hiking` records enter the totals (running/cycling never mix in);
 * - records are de-duplicated by run_id and invalid rows are dropped, never
 *   zero-filled;
 * - a missing value is `null` (rendered as "—"), never 0;
 * - cumulative climb is the sum of per-hike ascents that pass the plausibility
 *   test, with the coverage count always shown next to it. It is *not* the
 *   highest altitude reached, which is a separate, per-run figure;
 * - pace / speed are deliberately not part of the hiking story.
 */

export type MetricKey = 'distance' | 'count' | 'duration' | 'elevation';

export interface RunRecord extends Activity {
  date: string;
  year: number;
  month: number;
  day: number;
  distanceKm: number;
  seconds: number;
  /** per-hike ascent in metres; null when the source has no usable value */
  climbM: number | null;
  /** highest elevation reached on the route in metres; null when unknown */
  altitudeMaxM: number | null;
}

export interface HikingDataset {
  runs: RunRecord[];
  dropped: number;
}

export interface Totals {
  count: number;
  distanceKm: number;
  seconds: number;
  /** sum of every known, plausible ascent; null when nothing is known */
  climbM: number | null;
  /** how many hikes carry a usable ascent figure */
  climbCount: number;
  /** highest elevation reached anywhere in the scope; null when unknown */
  altitudeMaxM: number | null;
  aliveCount: number;
  hrCount: number;
  hrAverage: number | null;
  activeDays: number;
  firstDate: string | null;
  lastDate: string | null;
  longestStreak: number;
  currentStreak: number;
  averageDistanceKm: number | null;
  averageSeconds: number | null;
}

export interface YearPoint extends Totals {
  year: number;
}

export interface DayStat extends Totals {
  date: string;
  runs: RunRecord[];
}

export interface CalendarCell {
  day: number;
  date: string;
  count: number;
  distanceKm: number;
  climbM: number | null;
  runs: RunRecord[];
}

export interface CalendarMonth extends Totals {
  month: number;
  cells: Array<CalendarCell | null>;
}

export interface CalendarYear {
  year: number;
  months: CalendarMonth[];
  totals: Totals;
}

export interface RunScope {
  year: string; // 'all' or 'YYYY'
  month: number | null;
  date: string | null;
}

export interface GeoEntry {
  name: string;
  count: number;
  distanceKm: number;
}

export interface GeoSummary {
  countries: string[];
  provinces: GeoEntry[];
  cities: GeoEntry[];
  /** hikes that carry any structured location text */
  locatedCount: number;
  /** of those, hikes whose place came from the GPS track, not the watch */
  resolvedCount: number;
  /** locatedCount / total, 0–1 */
  coverage: number;
  homeProvince: string | null;
}

export interface RecordRow {
  label: string;
  value: string;
  date: string;
  runId: number;
}

export interface MilestoneStat {
  key: string;
  label: string;
  en: string;
  count: number;
}

export const METRICS: Array<{
  key: MetricKey;
  label: string;
  hint: string;
}> = [
  { key: 'distance', label: '里程', hint: '每年累计徒步里程' },
  { key: 'count', label: '次数', hint: '每年徒步次数' },
  { key: 'duration', label: '时间', hint: '每年累计徒步时长' },
  { key: 'elevation', label: '爬升', hint: '每年累计爬升（仅统计有爬升记录的徒步）' },
];

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/* ------------------------------------------------------------------ *
 * ascent rules — identical to JourneyStats so two views never disagree
 * ------------------------------------------------------------------ */

/**
 * Per-hike ascent.
 *
 * The 3D-terrain bake (`climb_terrain`) is preferred because it is derived
 * from the real elevation profile; the device figure (`elevation_gain`) is the
 * fallback. Early phone-GPS drift can inflate ascent to physical
 * impossibility, so a value is rejected (null) when:
 *   - it exceeds 2.5 × the highest altitude the route actually reached, or
 *   - with no altitude available, it exceeds 100 m per kilometre.
 * Rejected values are dropped from sums and shown as "—". Raw records are
 * never rewritten.
 */
export const climbOf = (run: Activity): number | null => {
  const altitude = run.altitude_max ?? null;
  const gain = run.climb_terrain || (run.elevation_gain ?? 0);
  if (!gain || !Number.isFinite(gain) || gain <= 0) return null;
  if (altitude && altitude > 0) {
    return gain <= 2.5 * altitude ? gain : null;
  }
  const distanceKm = run.distance / 1000;
  if (!(distanceKm > 0)) return null;
  return gain <= 100 * distanceKm ? gain : null;
};

/* ------------------------------------------------------------------ *
 * dataset
 * ------------------------------------------------------------------ */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const number = (value: number): string =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 });

const parseRunDate = (
  value: string | undefined
): { date: string; year: number; month: number; day: number } | null => {
  if (!value) return null;
  const match = ISO_DATE.exec(value.slice(0, 10));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { date: value.slice(0, 10), year, month, day };
};

/**
 * De-duplicate by run_id and keep only hiking records with a usable date,
 * distance and duration. Nothing is repaired with a zero.
 */
export const buildDataset = (raw: readonly Activity[]): HikingDataset => {
  const seen = new Set<number>();
  const runs: RunRecord[] = [];
  let dropped = 0;

  for (const activity of raw) {
    if (!activity || !/^hiking$/i.test(activity.type || '')) {
      dropped += 1;
      continue;
    }
    if (seen.has(activity.run_id)) {
      dropped += 1;
      continue;
    }
    seen.add(activity.run_id);

    const parsed = parseRunDate(activity.start_date_local);
    const distanceKm = activity.distance / 1000;
    const seconds = convertMovingTime2Sec(activity.moving_time);

    if (
      !parsed ||
      !Number.isFinite(distanceKm) ||
      distanceKm <= 0 ||
      !Number.isFinite(seconds) ||
      seconds <= 0
    ) {
      dropped += 1;
      continue;
    }

    const altitudeMaxM =
      activity.altitude_max && activity.altitude_max > 0
        ? activity.altitude_max
        : null;

    runs.push({
      ...activity,
      ...parsed,
      distanceKm,
      seconds,
      climbM: climbOf(activity),
      altitudeMaxM,
    });
  }

  return { runs, dropped };
};

const dayDiff = (a: string, b: string): number =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000
  );

const streaks = (dates: string[]): { longest: number; current: number } => {
  if (!dates.length) return { longest: 0, current: 0 };
  const sorted = [...new Set(dates)].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    run = dayDiff(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  let current = 1;
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    if (dayDiff(sorted[i - 1], sorted[i]) !== 1) break;
    current += 1;
  }
  return { longest, current };
};

export const computeTotals = (runs: readonly RunRecord[]): Totals => {
  let distanceKm = 0;
  let seconds = 0;
  let climbSum = 0;
  let climbCount = 0;
  let altitudeMaxM: number | null = null;
  let hrCount = 0;
  let hrSum = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const run of runs) {
    distanceKm += run.distanceKm;
    seconds += run.seconds;
    if (run.climbM !== null) {
      climbSum += run.climbM;
      climbCount += 1;
    }
    if (
      run.altitudeMaxM !== null &&
      (altitudeMaxM === null || run.altitudeMaxM > altitudeMaxM)
    ) {
      altitudeMaxM = run.altitudeMaxM;
    }
    if (run.average_heartrate) {
      hrCount += 1;
      hrSum += run.average_heartrate;
    }
    if (!firstDate || run.date < firstDate) firstDate = run.date;
    if (!lastDate || run.date > lastDate) lastDate = run.date;
  }

  const activeDates = runs.map((run) => run.date);
  const { longest, current } = streaks(activeDates);

  return {
    count: runs.length,
    distanceKm,
    seconds,
    climbM: climbCount ? climbSum : null,
    climbCount,
    altitudeMaxM,
    aliveCount: runs.filter((run) => run.altitudeMaxM !== null).length,
    hrCount,
    hrAverage: hrCount ? hrSum / hrCount : null,
    activeDays: new Set(activeDates).size,
    firstDate,
    lastDate,
    longestStreak: longest,
    currentStreak: runs.length ? current : 0,
    averageDistanceKm: runs.length ? distanceKm / runs.length : null,
    averageSeconds: runs.length ? seconds / runs.length : null,
  };
};

/** Runs that carry a usable altitude — the sample behind 最高到达海拔. */
export const aliveRuns = (runs: readonly RunRecord[]): RunRecord[] =>
  runs.filter((run) => run.altitudeMaxM !== null);

const climbs = (runs: readonly RunRecord[]): RunRecord[] =>
  runs.filter((run) => run.climbM !== null);

export const availableYears = (runs: readonly RunRecord[]): number[] =>
  [...new Set(runs.map((run) => run.year))].sort((a, b) => a - b);

export const buildYearSeries = (runs: readonly RunRecord[]): YearPoint[] => {
  const years = availableYears(runs);
  if (!years.length) return [];

  const byYear = new Map<number, RunRecord[]>();
  for (const run of runs) {
    const bucket = byYear.get(run.year);
    if (bucket) bucket.push(run);
    else byYear.set(run.year, [run]);
  }

  const out: YearPoint[] = [];
  for (let year = years[0]; year <= years[years.length - 1]; year += 1) {
    out.push({ year, ...computeTotals(byYear.get(year) ?? []) });
  }
  return out;
};

export const buildDayMap = (
  runs: readonly RunRecord[]
): Map<string, DayStat> => {
  const byDate = new Map<string, RunRecord[]>();
  for (const run of runs) {
    const bucket = byDate.get(run.date);
    if (bucket) bucket.push(run);
    else byDate.set(run.date, [run]);
  }
  const map = new Map<string, DayStat>();
  byDate.forEach((dayRuns, date) => {
    map.set(date, { date, runs: dayRuns, ...computeTotals(dayRuns) });
  });
  return map;
};

export const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

/** Monday-first offset: 0 = Monday, 6 = Sunday. */
export const firstWeekdayOffset = (year: number, month: number): number =>
  (new Date(year, month - 1, 1).getDay() + 6) % 7;

export const buildCalendar = (
  runs: readonly RunRecord[],
  year: number
): CalendarYear => {
  const yearRuns = runs.filter((run) => run.year === year);
  const dayMap = buildDayMap(yearRuns);
  const months: CalendarMonth[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const monthRuns = yearRuns.filter((run) => run.month === month);
    const cells: Array<CalendarCell | null> = [];
    const offset = firstWeekdayOffset(year, month);
    for (let i = 0; i < offset; i += 1) cells.push(null);

    const total = daysInMonth(year, month);
    for (let day = 1; day <= total; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;
      const stat = dayMap.get(date);
      cells.push({
        day,
        date,
        count: stat?.count ?? 0,
        distanceKm: stat?.distanceKm ?? 0,
        climbM: stat?.climbM ?? null,
        runs: stat?.runs ?? [],
      });
    }

    months.push({ month, cells, ...computeTotals(monthRuns) });
  }

  return { year, months, totals: computeTotals(yearRuns) };
};

export const filterRunsByScope = (
  runs: readonly RunRecord[],
  scope: RunScope
): RunRecord[] => {
  if (scope.date) {
    return runs.filter((run) => run.date === scope.date);
  }
  if (scope.year === 'all') return [...runs];
  const year = Number(scope.year);
  return runs.filter(
    (run) =>
      run.year === year &&
      (scope.month === null || run.month === scope.month)
  );
};

export const scopeLabel = (scope: RunScope): string => {
  if (scope.date) return formatDateCN(scope.date);
  if (scope.year === 'all') return '全部历史';
  if (scope.month) return `${scope.year} 年 ${scope.month} 月`;
  return `${scope.year} 年`;
};

/* ------------------------------------------------------------------ *
 * season / time-of-day / milestone buckets (real counts only)
 * ------------------------------------------------------------------ */

export interface SeasonStat {
  key: string;
  label: string;
  en: string;
  months: string;
  count: number;
}

const SEASONS: Array<Omit<SeasonStat, 'count'>> = [
  { key: 'spring', label: '春', en: 'Spring', months: '3–5 月' },
  { key: 'summer', label: '夏', en: 'Summer', months: '6–8 月' },
  { key: 'autumn', label: '秋', en: 'Autumn', months: '9–11 月' },
  { key: 'winter', label: '冬', en: 'Winter', months: '12–2 月' },
];

export const seasonKeyOfRun = (run: Activity): string => {
  const month = Number(run.start_date_local?.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return '';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
};

export const buildSeasons = (runs: readonly Activity[]): SeasonStat[] => {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const key = seasonKeyOfRun(run);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return SEASONS.map((season) => ({
    ...season,
    count: counts.get(season.key) ?? 0,
  })).filter((season) => season.count > 0);
};

export const filterRunsBySeason = (run: RunRecord, key: string): boolean =>
  seasonKeyOfRun(run) === key;

export const seasonLabelOfKey = (key: string): string => {
  const season = SEASONS.find((item) => item.key === key);
  return season ? `${season.label}季` : key;
};

export interface PeriodStat {
  key: string;
  label: string;
  en: string;
  alpha: number;
  count: number;
}

/** Same five buckets the rest of the site uses (`periodTitleForRun`). */
const PERIODS: Array<Omit<PeriodStat, 'count'> & { title: string }> = [
  { key: 'morning', title: HIKE_TITLES.MORNING_HIKE_TITLE, label: '清晨', en: 'Morning', alpha: 95 },
  { key: 'midday', title: HIKE_TITLES.MIDDAY_HIKE_TITLE, label: '午间', en: 'Midday', alpha: 76 },
  { key: 'afternoon', title: HIKE_TITLES.AFTERNOON_HIKE_TITLE, label: '午后', en: 'Afternoon', alpha: 58 },
  { key: 'evening', title: HIKE_TITLES.EVENING_HIKE_TITLE, label: '傍晚', en: 'Evening', alpha: 44 },
  { key: 'night', title: HIKE_TITLES.NIGHT_HIKE_TITLE, label: '夜晚', en: 'Night', alpha: 32 },
];

export const periodKeyOfRun = (run: Activity): string => {
  const title = periodTitleForRun(run);
  const bucket = PERIODS.find((item) => item.title === title);
  return bucket ? bucket.key : '';
};

export const buildPeriods = (runs: readonly Activity[]): PeriodStat[] => {
  const counts = new Map<string, number>();
  for (const run of runs) {
    const key = periodKeyOfRun(run);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return PERIODS.map(({ key, label, en, alpha }) => ({
    key,
    label,
    en,
    alpha,
    count: counts.get(key) ?? 0,
  })).filter((period) => period.count > 0);
};

export const filterRunsByPeriod = (run: RunRecord, key: string): boolean =>
  periodKeyOfRun(run) === key;

export const periodLabelOfKey = (key: string): string =>
  PERIODS.find((item) => item.key === key)?.label ?? key;

export const buildMilestones = (
  runs: readonly RunRecord[]
): MilestoneStat[] => [
  {
    key: MILESTONE_KEYS.LONG_HIKE,
    label: '长线 20 km+',
    en: 'Long day',
    count: runs.filter((run) => run.distanceKm >= 20).length,
  },
  {
    key: MILESTONE_KEYS.THOUSAND_CLIMB,
    label: '千米爬升 1000 m+',
    en: 'Big climb',
    count: runs.filter((run) => (run.climbM ?? 0) >= 1000).length,
  },
];

export const filterRunsByMilestone = (run: RunRecord, key: string): boolean =>
  key === MILESTONE_KEYS.LONG_HIKE
    ? run.distanceKm >= 20
    : (run.climbM ?? 0) >= 1000;

export const milestoneLabelOfKey = (key: string): string =>
  key === MILESTONE_KEYS.LONG_HIKE ? '长线 20 km+' : '千米爬升 1000 m+';

/* ------------------------------------------------------------------ *
 * records — computed live from history, missing stays missing
 * ------------------------------------------------------------------ */

const fmtClock = (seconds: number): string => {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

/**
 * Personal bests. A hike only qualifies for time-based records when it is a
 * real mountain outing (plausible speed 1.5–6.5 km/h and ascent ≥ 150 m), so
 * flat walks and forgotten-watch sessions never top the list.
 */
export const computeRecords = (runs: readonly RunRecord[]): RecordRow[] => {
  if (!runs.length) return [];

  const plausible = runs.filter((run) => {
    const kmh = (run.average_speed || 0) * 3.6;
    return run.distanceKm > 0 && kmh >= 1.5 && kmh <= 6.5;
  });
  if (!plausible.length) return [];

  const mountain = plausible.filter((run) => (run.climbM ?? 0) >= 150);
  const rows: RecordRow[] = [];

  const far = plausible.reduce((a, b) =>
    b.distanceKm > a.distanceKm ? b : a
  );
  rows.push({
    label: '最远距离',
    value: `${formatDistanceKm(far.distanceKm)} km`,
    date: far.date,
    runId: far.run_id,
  });

  if (mountain.length) {
    const longest = mountain.reduce((a, b) => (b.seconds > a.seconds ? b : a));
    rows.push({
      label: '最长时间',
      value: fmtClock(longest.seconds),
      date: longest.date,
      runId: longest.run_id,
    });
  }

  const climbing = climbs(plausible);
  if (climbing.length) {
    const highestClimb = climbing.reduce((a, b) =>
      (b.climbM ?? 0) > (a.climbM ?? 0) ? b : a
    );
    rows.push({
      label: '单次最大爬升',
      value: `${formatNumber(Math.round(highestClimb.climbM ?? 0))} m`,
      date: highestClimb.date,
      runId: highestClimb.run_id,
    });
  }

  const high = aliveRuns(runs);
  if (high.length) {
    const highestAlt = high.reduce((a, b) =>
      (b.altitudeMaxM ?? 0) > (a.altitudeMaxM ?? 0) ? b : a
    );
    rows.push({
      label: '最高到达海拔',
      value: `${formatNumber(Math.round(highestAlt.altitudeMaxM ?? 0))} m`,
      date: highestAlt.date,
      runId: highestAlt.run_id,
    });
  }

  return rows;
};

/* ------------------------------------------------------------------ *
 * geography — only what the record actually states
 * ------------------------------------------------------------------ */

const MUNICIPALITIES = [
  '北京市',
  '上海市',
  '天津市',
  '重庆市',
  '香港特别行政区',
  '澳门特别行政区',
];

const DICT_PROVINCE = /'province':\s*'([^']+)'/;
const DICT_CITY = /'city':\s*'([^']+)'/;
const DICT_COUNTRY = /'country':\s*'([^']+)'/;
const ADDRESS_CITY = /[\u4e00-\u9fa5]{2,}(?:市|自治州|特别行政区|盟|地区)/g;
const ADDRESS_PROVINCE = /[\u4e00-\u9fa5]{2,}(?:省|自治区)/;

const clean = (value: string | undefined): string => {
  if (!value || value === 'None') return '';
  return value.trim();
};

export interface ParsedLocation {
  country: string;
  province: string;
  city: string;
}

/**
 * Location as the record states it, or as its track places it.
 *
 * Two shapes appear in `location_country`:
 * - a Python-dict repr with real `province` / `city` keys (Strava),
 * - a plain address string ("长安区, 西安市, 陕西省, 710124, 中国").
 * Both are read as text. `location_resolved` is the third shape: a place
 * derived offline from the GPS track, in the same address-tail format, written
 * by run_page/resolve_locations_rh.py only where the watch left the field
 * empty — the device value always wins, and the geographic note reports how
 * many records came from which source.
 */
export const locationOfRun = (run: Activity): ParsedLocation | null => {
  const raw = run.location_country || run.location_resolved;
  if (!raw) return null;

  const dictProvince = DICT_PROVINCE.exec(raw);
  const dictCity = DICT_CITY.exec(raw);
  if (dictProvince || dictCity) {
    return {
      country: clean(DICT_COUNTRY.exec(raw)?.[1]),
      province: clean(dictProvince?.[1]),
      city: clean(dictCity?.[1]),
    };
  }

  const cityTokens = raw.match(ADDRESS_CITY) ?? [];
  const city = cityTokens.length ? cityTokens[cityTokens.length - 1] : '';
  const provinceMatch = ADDRESS_PROVINCE.exec(raw);
  let province = provinceMatch ? provinceMatch[0] : '';
  if (!province && MUNICIPALITIES.includes(city)) province = city;
  const countryMatch = /[\u4e00-\u9fa5]{2,}$/.exec(raw.replace(/[\d,]+$/, ''));
  return {
    country: clean(countryMatch?.[0]) || '中国',
    province,
    city,
  };
};

export const computeGeo = (runs: readonly RunRecord[]): GeoSummary => {
  const provinceMap = new Map<string, GeoEntry>();
  const cityMap = new Map<string, GeoEntry>();
  const countries = new Set<string>();
  let locatedCount = 0;
  let resolvedCount = 0;

  for (const run of runs) {
    const location = locationOfRun(run);
    if (!location) continue;
    if (!location.province && !location.city) continue;
    locatedCount += 1;
    if (!run.location_country && run.location_resolved) resolvedCount += 1;
    if (location.country) countries.add(location.country);

    const bump = (map: Map<string, GeoEntry>, name: string) => {
      const entry = map.get(name) ?? { name, count: 0, distanceKm: 0 };
      entry.count += 1;
      entry.distanceKm += run.distanceKm;
      map.set(name, entry);
    };
    if (location.province) bump(provinceMap, location.province);
    if (location.city && location.city !== location.province) {
      bump(cityMap, location.city);
    }
  }

  const byCount = (a: GeoEntry, b: GeoEntry) =>
    b.count - a.count || b.distanceKm - a.distanceKm;
  const provinces = [...provinceMap.values()].sort(byCount);
  const cities = [...cityMap.values()].sort(byCount);
  const homeProvince = provinces.length
    ? provinces[0].name
        .replace(/(维吾尔|壮族|回族)?自治区$/, '')
        .replace(/特别行政区$/, '')
        .replace(/[省市]$/, '')
    : null;

  return {
    countries: [...countries],
    provinces,
    cities,
    locatedCount,
    resolvedCount,
    coverage: runs.length ? locatedCount / runs.length : 0,
    homeProvince: homeProvince || null,
  };
};

export const filterRunsByProvince = (run: RunRecord, name: string): boolean =>
  locationOfRun(run)?.province === name;

/* ------------------------------------------------------------------ *
 * formatting
 * ------------------------------------------------------------------ */

export const formatNumber = number;

export const formatDistanceKm = (km: number | null): string => {
  if (km === null || !Number.isFinite(km)) return '—';
  return km.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: km >= 100 ? 1 : 2,
  });
};

export const formatClimb = (metres: number | null): string =>
  metres === null || !Number.isFinite(metres)
    ? '—'
    : `${formatNumber(Math.round(metres))} m`;

export const formatAltitude = (metres: number | null): string =>
  metres === null || !Number.isFinite(metres) || metres <= 0
    ? '—'
    : `${formatNumber(Math.round(metres))} m`;

export const formatDurationLong = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} m`;
  return `${formatNumber(hours)} h ${String(minutes).padStart(2, '0')} m`;
};

export const formatRunClock = fmtClock;

export const formatDateCN = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
};

export const formatDateShort = (date: string): string => {
  const [, month, day] = date.split('-');
  return `${Number(month)}.${String(Number(day)).padStart(2, '0')}`;
};

export const formatMonthCN = (month: number): string => `${month} 月`;

export const weekdayCN = (date: string): string => {
  const index = new Date(`${date}T00:00:00`).getDay();
  return `周${['日', '一', '二', '三', '四', '五', '六'][index]}`;
};

/**
 * Calendar shading thresholds. Distance is in km, elevation in metres of
 * ascent; a day with no known ascent stays unshaded even in 爬升 mode.
 */
const LEVELS: Record<'distance' | 'elevation', number[]> = {
  distance: [3, 6, 10, 15, 22],
  elevation: [80, 250, 500, 900, 1400],
};

export const calendarLevel = (
  value: number | null,
  metric: 'distance' | 'elevation' = 'distance'
): 0 | 1 | 2 | 3 | 4 | 5 => {
  if (value === null || !(value > 0)) return 0;
  const steps = LEVELS[metric];
  if (value < steps[0]) return 1;
  if (value < steps[1]) return 2;
  if (value < steps[2]) return 3;
  if (value < steps[3]) return 4;
  return 5;
};

export const metricNumber = (
  point: Totals,
  metric: MetricKey
): number | null => {
  switch (metric) {
    case 'distance':
      return point.distanceKm;
    case 'count':
      return point.count;
    case 'duration':
      return point.seconds;
    case 'elevation':
      return point.climbM;
  }
};

export const formatMetric = (point: Totals, metric: MetricKey): string => {
  switch (metric) {
    case 'distance':
      return `${formatDistanceKm(point.distanceKm)} km`;
    case 'count':
      return `${formatNumber(point.count)} 次`;
    case 'duration':
      return formatDurationLong(point.seconds);
    case 'elevation':
      return formatClimb(point.climbM);
  }
};

/** Share of hikes carrying the data a metric depends on. */
export const metricCoverage = (
  point: Totals,
  metric: MetricKey
): number | null => {
  if (metric === 'elevation') {
    return point.count ? point.climbCount / point.count : null;
  }
  if (metric === 'count' || !point.count) return null;
  return 1;
};
