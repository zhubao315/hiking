import {
  computeTotals,
  formatAltitude,
  formatClimb,
  formatDateCN,
  formatDistanceKm,
  formatDurationLong,
  formatRunClock,
  weekdayCN,
  type RunRecord,
} from '@/utils/hikingStats';
import { titleForRun } from '@/utils/utils';
import { sceneHashOf } from '@/vert/scenes';
import styles from './style.module.css';

interface IDayDetailProps {
  date: string;
  runs: RunRecord[];
  selectedRunId: number | null;
  onSelectRun: (_runId: number) => void;
  onClose: () => void;
}

const DayDetail = ({
  date,
  runs,
  selectedRunId,
  onSelectRun,
  onClose,
}: IDayDetailProps) => {
  const totals = computeTotals(runs);
  const ordered = [...runs].sort((a, b) =>
    a.start_date_local.localeCompare(b.start_date_local)
  );

  return (
    <article className={styles.dayDetail} aria-labelledby="day-detail-title">
      <header className={styles.dayDetailHead}>
        <div>
          <p className={styles.dayKicker}>
            {weekdayCN(date)} · {totals.count} 次徒步
          </p>
          <h3 id="day-detail-title" className={styles.dayTitle}>
            {formatDateCN(date)}
          </h3>
        </div>
        <div className={styles.dayTotals}>
          <span>
            <strong>{formatDistanceKm(totals.distanceKm)}</strong> km
          </span>
          <span>
            <strong>{formatDurationLong(totals.seconds)}</strong>
          </span>
          <span>
            <strong>{formatClimb(totals.climbM)}</strong>
          </span>
          {totals.altitudeMaxM !== null ? (
            <span title="当天到达的最高海拔">
              <strong>{formatAltitude(totals.altitudeMaxM)}</strong>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.dayClose}
          onClick={onClose}
          aria-label="收起当日详情"
        >
          收起
        </button>
      </header>

      <ul className={styles.dayRuns}>
        {ordered.map((run) => {
          const selected = selectedRunId === run.run_id;
          return (
            <li key={run.run_id}>
              <button
                type="button"
                className={`${styles.dayRun} ${
                  selected ? styles.dayRunSelected : ''
                }`}
                onClick={() => onSelectRun(run.run_id)}
                aria-pressed={selected}
              >
                <span className={styles.runTime}>
                  {run.start_date_local.slice(11, 16)}
                </span>
                <span className={styles.runName}>{titleForRun(run)}</span>
                <span className={styles.runStat}>
                  {formatDistanceKm(run.distanceKm)} km
                </span>
                <span className={styles.runStat}>
                  {formatClimb(run.climbM)}
                </span>
                <span className={styles.runStat}>
                  {formatAltitude(run.altitudeMaxM)}
                </span>
                <span className={styles.runStat}>
                  {formatRunClock(run.seconds)}
                </span>
                {sceneHashOf(run.run_id) ? (
                  <span className={styles.badge3d}>3D</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <p className={styles.dayHint}>
        点击记录在地图上定位并展开地形剖面，带 3D 标记的徒步有烘焙好的地形数据。
      </p>
    </article>
  );
};

export default DayDetail;
