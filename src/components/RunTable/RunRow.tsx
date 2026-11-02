import type { KeyboardEvent } from 'react';
import {
  formatAltitude,
  formatClimb,
  formatDistanceKm,
  formatRunClock,
  type RunRecord,
} from '@/utils/hikingStats';
import { titleForRun } from '@/utils/utils';
import { sceneHashOf } from '@/vert/scenes';
import styles from './style.module.css';

interface IRunRowProperties {
  run: RunRecord;
  selected: boolean;
  onSelect: (_runId: number | null) => void;
}

const RunRow = ({ run, selected, onSelect }: IRunRowProperties) => {
  const handleClick = () => onSelect(selected ? null : run.run_id);
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <tr
      className={`${styles.runRow} ${selected ? styles.selected : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-selected={selected}
    >
      <td>
        {titleForRun(run)}
        {sceneHashOf(run.run_id) ? (
          <sup title="查看 3D 地形" className={styles.badge3d}>
            3D
          </sup>
        ) : null}
      </td>
      <td>{formatDistanceKm(run.distanceKm)}</td>
      <td title={run.climbM === null ? '无爬升数据' : undefined}>
        {formatClimb(run.climbM)}
      </td>
      <td title={run.altitudeMaxM === null ? '无海拔数据' : undefined}>
        {formatAltitude(run.altitudeMaxM)}
      </td>
      <td>{formatRunClock(run.seconds)}</td>
      <td className={styles.runDate}>
        {run.start_date_local.slice(0, 10)}
        <span className={styles.runClock}>
          {run.start_date_local.slice(11, 16)}
        </span>
      </td>
    </tr>
  );
};

export default RunRow;
