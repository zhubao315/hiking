import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import RunMap from '@/components/RunMap';
import RunTable from '@/components/RunTable';
import TerrainCard from '@/components/TerrainCard';
import HikingDashboard from '@/components/HikingDashboard';
import DayDetail from '@/components/HikingDashboard/DayDetail';
import Journey from '@/components/HikingDashboard/Journey';
import RunCalendar, {
  type CalendarMetric,
} from '@/components/HikingDashboard/RunCalendar';
import SectionHeader from '@/components/HikingDashboard/SectionHeader';
import useActivities from '@/hooks/useActivities';
import { sceneHashOf } from '@/vert/scenes';
import {
  IViewState,
  RunGeoData,
  geoJsonForRuns,
  getBoundsForGeoData,
  scrollToMap,
  titleForShow,
} from '@/utils/utils';
import {
  availableYears,
  buildCalendar,
  buildDataset,
  buildYearSeries,
  computeTotals,
  filterRunsByMilestone,
  filterRunsByPeriod,
  filterRunsByProvince,
  filterRunsByScope,
  filterRunsBySeason,
  formatDistanceKm,
  formatNumber,
  milestoneLabelOfKey,
  periodLabelOfKey,
  scopeLabel,
  seasonLabelOfKey,
  type MetricKey,
  type RunRecord,
  type RunScope,
} from '@/utils/hikingStats';
import styles from '@/components/HikingDashboard/style.module.css';

type QuickKind = 'province' | 'season' | 'period' | 'milestone';

type QuickFilter = {
  kind: QuickKind;
  value: string;
} | null;

const QUICK_PREDICATE: Record<
  QuickKind,
  (_run: RunRecord, _value: string) => boolean
> = {
  province: filterRunsByProvince,
  season: filterRunsBySeason,
  period: filterRunsByPeriod,
  milestone: filterRunsByMilestone,
};

const quickLabel = (filter: NonNullable<QuickFilter>): string => {
  switch (filter.kind) {
    case 'province':
      return `省份 · ${filter.value}`;
    case 'season':
      return `季节 · ${seasonLabelOfKey(filter.value)}`;
    case 'period':
      return `时段 · ${periodLabelOfKey(filter.value)}`;
    case 'milestone':
      return `里程碑 · ${milestoneLabelOfKey(filter.value)}`;
  }
};

const Index = () => {
  const { activities } = useActivities();
  const { runs } = useMemo(() => buildDataset(activities), [activities]);

  const [selectedYear, setSelectedYear] = useState(() => {
    const years = availableYears(runs);
    return years.length ? String(years[years.length - 1]) : 'all';
  });
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] =
    useState<MetricKey>('distance');
  const [calendarMetric, setCalendarMetric] =
    useState<CalendarMetric>('distance');
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const scrollOnSelect = useRef(false);

  const scope: RunScope = useMemo(
    () => ({
      year: selectedYear,
      month: selectedMonth,
      date: selectedDate,
    }),
    [selectedYear, selectedMonth, selectedDate]
  );

  const filterNote = quickFilter ? quickLabel(quickFilter) : null;

  // province / season / time-of-day / milestone shortcuts narrow the whole
  // dashboard, not just the record table.
  const baseRuns = useMemo(() => {
    if (!quickFilter) return runs;
    return runs.filter((run) =>
      QUICK_PREDICATE[quickFilter.kind](run, quickFilter.value)
    );
  }, [runs, quickFilter]);

  const scopeRuns = useMemo(
    () => filterRunsByScope(baseRuns, scope),
    [baseRuns, scope]
  );

  const selectedRun =
    selectedRunId === null
      ? undefined
      : runs.find((run) => run.run_id === selectedRunId);

  const mapRuns = useMemo(
    () => (selectedRun ? [selectedRun] : scopeRuns),
    [selectedRun, scopeRuns]
  );

  const fullGeoData = useMemo(() => geoJsonForRuns(mapRuns), [mapRuns]);
  const [geoData, setGeoData] = useState<RunGeoData>(
    () => fullGeoData
  );

  const bounds = useMemo(
    () => getBoundsForGeoData(fullGeoData),
    [fullGeoData]
  );
  const [viewState, setViewState] = useState<IViewState>({ ...bounds });

  useEffect(() => {
    setViewState({ ...bounds });
  }, [bounds]);

  // Draw large scopes in a few frames so MapLibre never blocks the main thread
  // on a single mutation of several hundred polylines.
  useEffect(() => {
    const features = fullGeoData.features;
    if (features.length <= 240 || selectedRun) {
      setGeoData(fullGeoData);
      return;
    }

    const step = Math.max(1, Math.ceil(features.length / 18));
    let count = step;
    setGeoData({ ...fullGeoData, features: features.slice(0, count) });
    const timer = window.setInterval(() => {
      count += step;
      if (count >= features.length) {
        setGeoData(fullGeoData);
        window.clearInterval(timer);
      } else {
        setGeoData({
          ...fullGeoData,
          features: features.slice(0, count),
        });
      }
    }, 70);

    return () => window.clearInterval(timer);
  }, [fullGeoData, selectedRun]);

  const clearScope = useCallback(() => {
    setSelectedYear('all');
    setSelectedMonth(null);
    setSelectedDate(null);
    setSelectedRunId(null);
    setQuickFilter(null);
  }, []);

  const selectYear = useCallback((year: string) => {
    setSelectedYear(year);
    setSelectedMonth(null);
    setSelectedDate(null);
    setSelectedRunId(null);
    setQuickFilter(null);
  }, []);

  const selectMonth = useCallback((year: number, month: number) => {
    setSelectedYear(String(year));
    setSelectedMonth(month);
    setSelectedDate(null);
    setSelectedRunId(null);
    setQuickFilter(null);
  }, []);

  const selectDate = useCallback(
    (date: string) => {
      if (selectedDate === date) {
        setSelectedDate(null);
        setSelectedRunId(null);
        return;
      }
      setSelectedYear(date.slice(0, 4));
      setSelectedMonth(Number(date.slice(5, 7)));
      setSelectedDate(date);
      setSelectedRunId(null);
      setQuickFilter(null);
    },
    [selectedDate]
  );

  const selectRun = useCallback((runId: number | null) => {
    setSelectedRunId(runId);
    if (runId !== null) {
      scrollOnSelect.current = true;
      scrollToMap();
    }
  }, []);

  // A click on a representative record lands on that exact run_id: the scope
  // follows the hike's own year / month / date so the calendar and map agree.
  const focusRun = useCallback(
    (runId: number) => {
      const run = runs.find((item) => item.run_id === runId);
      if (!run) return;
      setSelectedYear(String(run.year));
      setSelectedMonth(run.month);
      setSelectedDate(run.date);
      setSelectedRunId(runId);
      scrollOnSelect.current = true;
      scrollToMap();
    },
    [runs]
  );

  const selectQuickFilter = useCallback(
    (kind: QuickKind, value: string) => {
      setQuickFilter({ kind, value });
      setSelectedYear('all');
      setSelectedMonth(null);
      setSelectedDate(null);
      setSelectedRunId(null);
      scrollToMap();
    },
    []
  );

  const terrainRef = useRef<HTMLDivElement>(null);

  // A run with a baked scene opens the 3D card below the map; bring it into
  // view once the map's own scroll has landed.
  useEffect(() => {
    if (!scrollOnSelect.current) return;
    scrollOnSelect.current = false;
    if (!selectedRun || !sceneHashOf(selectedRun.run_id)) return;
    const timer = window.setTimeout(() => {
      terrainRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [selectedRun?.run_id]);

  const scopeTotals = useMemo(() => computeTotals(scopeRuns), [scopeRuns]);

  const mapTitle = useMemo(() => {
    if (selectedRun) return titleForShow(selectedRun);
    const label = filterNote ?? scopeLabel(scope);
    if (!scopeRuns.length) return `${label} · 无记录`;
    return `${label} · ${formatNumber(scopeRuns.length)} 次 · ${formatDistanceKm(
      scopeTotals.distanceKm
    )} km`;
  }, [selectedRun, filterNote, scope, scopeRuns, scopeTotals.distanceKm]);

  const yearSeries = useMemo(() => buildYearSeries(baseRuns), [baseRuns]);
  const latestYear = yearSeries.length
    ? yearSeries[yearSeries.length - 1].year
    : new Date().getFullYear();
  const calendarYear = selectedDate
    ? Number(selectedDate.slice(0, 4))
    : selectedMonth
      ? Number(selectedYear)
      : selectedYear !== 'all'
        ? Number(selectedYear)
        : latestYear;
  const calendar = useMemo(
    () => buildCalendar(baseRuns, calendarYear),
    [baseRuns, calendarYear]
  );
  const dayRuns = useMemo(
    () =>
      selectedDate ? scopeRuns.filter((run) => run.date === selectedDate) : [],
    [scopeRuns, selectedDate]
  );
  const minYear = yearSeries.length ? yearSeries[0].year : calendarYear;
  const maxYear = latestYear;

  return (
    <Layout>
      <HikingDashboard
        runs={runs}
        baseRuns={baseRuns}
        scopeRuns={scopeRuns}
        scope={scope}
        filterNote={filterNote}
        selectedMetric={selectedMetric}
        onSelectYear={selectYear}
        onSelectMonth={selectMonth}
        onSelectMetric={setSelectedMetric}
        onClearScope={clearScope}
      />

      <section id="journey" className={styles.section}>
        <Journey
          runs={baseRuns}
          onSelectRun={focusRun}
          onSelectProvince={(name) => selectQuickFilter('province', name)}
          onSelectSeason={(key) => selectQuickFilter('season', key)}
          onSelectPeriod={(key) => selectQuickFilter('period', key)}
          onSelectMilestone={(key) => selectQuickFilter('milestone', key)}
        />
      </section>

      <section id="explore" className={styles.section}>
        <SectionHeader index="05" kicker="TRAIL EXPLORER" title="徒步探索">
          <span className={styles.scopePill}>
            {filterNote ?? scopeLabel(scope)}
          </span>
        </SectionHeader>

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <RunMap
              title={mapTitle}
              viewState={viewState}
              geoData={geoData}
              setViewState={setViewState}
              changeYear={(year) =>
                selectYear(year === 'Total' ? 'all' : year)
              }
              thisYear={selectedYear === 'all' ? 'Total' : selectedYear}
            />
            <p className="border-t border-[#2a2a2a] px-4 py-2 text-xs text-[#777]">
              轨迹按记录原样绘制；信号中断处断开显示，不做直线连接。
            </p>
          </div>

          <div ref={terrainRef} className="scroll-mt-20">
            {selectedRun ? <TerrainCard run={selectedRun} /> : null}
          </div>

          <div className="card p-4 lg:p-6">
            <RunTable
              runs={scopeRuns}
              selectedRunId={selectedRunId}
              onSelectRun={selectRun}
              onClearScope={clearScope}
            />
          </div>
        </div>
      </section>

      <section id="calendar" className={styles.section}>
        <div className="card p-4 lg:p-6">
          <RunCalendar
            calendar={calendar}
            metric={calendarMetric}
            selectedMonth={selectedMonth}
            selectedDate={selectedDate}
            minYear={minYear}
            maxYear={maxYear}
            onSelectMonth={selectMonth}
            onSelectDate={selectDate}
            onSelectYear={selectYear}
            onSelectMetric={setCalendarMetric}
          />
          {selectedDate && dayRuns.length ? (
            <DayDetail
              date={selectedDate}
              runs={dayRuns}
              selectedRunId={selectedRunId}
              onSelectRun={selectRun}
              onClose={() => selectDate(selectedDate)}
            />
          ) : null}
        </div>
      </section>

      {/* Enable Audiences in Vercel Analytics: https://vercel.com/docs/concepts/analytics/analytics/quickstart */}
      {import.meta.env.VERCEL && <Analytics />}
    </Layout>
  );
};

export default Index;
