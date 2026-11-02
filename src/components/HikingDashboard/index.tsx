import { useMemo } from 'react';
import Profile from './Profile';
import CoreMetrics from './CoreMetrics';
import YearTrend from './YearTrend';
import {
  buildYearSeries,
  computeTotals,
  formatDateCN,
  formatNumber,
  scopeLabel,
  type MetricKey,
  type RunRecord,
  type RunScope,
} from '@/utils/hikingStats';
import styles from './style.module.css';

interface IHikingDashboardProps {
  runs: RunRecord[];
  /** career hikes, narrowed by the province / season / period shortcut but not by year */
  baseRuns: RunRecord[];
  scopeRuns: RunRecord[];
  scope: RunScope;
  filterNote: string | null;
  selectedMetric: MetricKey;
  onSelectYear: (_year: string) => void;
  onSelectMonth: (_year: number, _month: number) => void;
  onSelectMetric: (_metric: MetricKey) => void;
  onClearScope: () => void;
}

const HikingDashboard = ({
  runs,
  baseRuns,
  scopeRuns,
  scope,
  filterNote,
  selectedMetric,
  onSelectYear,
  onSelectMonth,
  onSelectMetric,
  onClearScope,
}: IHikingDashboardProps) => {
  const careerTotals = useMemo(() => computeTotals(runs), [runs]);
  const scopeTotals = useMemo(() => computeTotals(scopeRuns), [scopeRuns]);
  const yearSeries = useMemo(() => buildYearSeries(baseRuns), [baseRuns]);
  const filtering =
    scope.year !== 'all' ||
    scope.month !== null ||
    scope.date !== null ||
    Boolean(filterNote);

  const scopeText = filterNote ?? scopeLabel(scope);

  const mappable = useMemo(
    () => runs.filter((run) => Boolean(run.summary_polyline)).length,
    [runs]
  );
  const withAltitude = useMemo(
    () => runs.filter((run) => run.altitudeMaxM !== null).length,
    [runs]
  );
  const withClimb = useMemo(
    () => runs.filter((run) => run.climbM !== null).length,
    [runs]
  );
  const withHeartRate = useMemo(
    () => runs.filter((run) => (run.average_heartrate ?? 0) > 0).length,
    [runs]
  );

  const pct = (part: number, whole: number) =>
    whole ? Math.round((part / whole) * 100) : 0;

  return (
    <div className={styles.dashboard}>
      <Profile runs={runs} />

      <nav className={styles.scopeBar} aria-label="当前筛选范围">
        <span className={styles.scopeCaption}>当前范围</span>
        {filtering ? (
          <button
            type="button"
            className={styles.scopeLink}
            onClick={onClearScope}
          >
            全部历史
          </button>
        ) : (
          <span className={styles.scopeCurrent} aria-current="true">
            全部历史
          </span>
        )}

        {scope.year !== 'all' ? (
          <>
            <span className={styles.scopeSep}>/</span>
            {scope.month || scope.date ? (
              <button
                type="button"
                className={styles.scopeLink}
                onClick={() => onSelectYear(scope.year)}
              >
                {scope.year} 年
              </button>
            ) : (
              <span className={styles.scopeCurrent} aria-current="true">
                {scope.year} 年
              </span>
            )}
          </>
        ) : null}

        {scope.month ? (
          <>
            <span className={styles.scopeSep}>/</span>
            {scope.date ? (
              <button
                type="button"
                className={styles.scopeLink}
                onClick={() =>
                  onSelectMonth(Number(scope.year), scope.month as number)
                }
              >
                {scope.month} 月
              </button>
            ) : (
              <span className={styles.scopeCurrent} aria-current="true">
                {scope.month} 月
              </span>
            )}
          </>
        ) : null}

        {scope.date ? (
          <>
            <span className={styles.scopeSep}>/</span>
            <span className={styles.scopeCurrent} aria-current="date">
              {formatDateCN(scope.date)}
            </span>
          </>
        ) : null}

        {filterNote ? (
          <span className={styles.scopeChip}>{filterNote}</span>
        ) : null}

        {filtering ? (
          <button
            type="button"
            className={styles.scopeClear}
            onClick={onClearScope}
          >
            清除筛选 ×
          </button>
        ) : null}
      </nav>

      <CoreMetrics totals={scopeTotals} scope={scopeText} runs={scopeRuns} />

      <YearTrend
        series={yearSeries}
        metric={selectedMetric}
        selectedYear={scope.year}
        onSelectMetric={onSelectMetric}
        onSelectYear={onSelectYear}
      />

      <details className={styles.dataNotes}>
        <summary>数据说明</summary>
        <p>
          本页只统计徒步记录：{formatNumber(runs.length)} 条，
          {careerTotals.firstDate ? (
            <>
              {' '}
              从 {formatDateCN(careerTotals.firstDate)} 到{' '}
              {formatDateCN(careerTotals.lastDate ?? careerTotals.firstDate)}
            </>
          ) : null}
          。唯一 ID 为 run_id，四个模块共用同一份数据；原始记录不做任何改写，
          缺失值显示为「—」，不以 0 或平均值顶替。跑步与骑行记录不混入本页。
        </p>
        <p>
          轨迹仅 {formatNumber(mappable)} / {formatNumber(runs.length)} 条
          （{pct(mappable, runs.length)}%）带有 GPS 摘要线，因此地图与 3D
          地形只覆盖这部分徒步，其余记录仍在日历、趋势与表格中完整出现。
        </p>
        <p>
          累计爬升只累加单次可信值：优先使用 3D 地形烘焙出的爬升量，其次才是设备
          记录的爬升；单次爬升超过自身最高海拔 2.5 倍，或在没有海拔数据时超过
          100 m/km 的物理不可能值视为缺失（现存 {formatNumber(withClimb)} /{' '}
          {formatNumber(runs.length)} 条可用）。爬升与「最高到达海拔」是两个
          独立概念，后者来自 {formatNumber(withAltitude)} /{' '}
          {formatNumber(runs.length)} 条徒步的地形剖面。海拔与爬升都缺失的年份在
          趋势图中显示为「–」，不以 0 参与比较。
        </p>
        <p>
          心率仅 {formatNumber(withHeartRate)} / {formatNumber(runs.length)} 条
          记录包含，因此不作为核心指标；配速与速度只代表行进效率，徒步页面以里程、
          时长、爬升、海拔与地理分布为主线。设备数据不含功率、踏频、热量与下降
          字段，页面也不展示这些指标。
        </p>
      </details>
    </div>
  );
};

export default HikingDashboard;
