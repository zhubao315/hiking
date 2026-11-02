import { useMemo } from 'react';
import SectionHeader from './SectionHeader';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import {
  computeTotals,
  formatAltitude,
  formatDistanceKm,
  formatNumber,
  type RunRecord,
} from '@/utils/hikingStats';
import styles from './style.module.css';

const dotDate = (date: string | null): string =>
  date ? date.replaceAll('-', '.') : '—';

interface IProfileProps {
  runs: RunRecord[];
}

const Profile = ({ runs }: IProfileProps) => {
  const meta = useSiteMetadata();
  const totals = useMemo(() => computeTotals(runs), [runs]);

  const firstYear = totals.firstDate?.slice(0, 4) ?? '';
  const lastYear = totals.lastDate?.slice(0, 4) ?? '';
  const span = firstYear && lastYear ? `${firstYear}—${lastYear}` : '';

  return (
    <section className={styles.profile} aria-labelledby="profile-title">
      <SectionHeader index="01" kicker="HIKING PROFILE" title="个人徒步档案" />
      <div className={styles.profileIdentity}>
        <img className={styles.avatar} src={meta.logo} alt="" />
        <div className={styles.profileText}>
          <h1 id="profile-title" className={styles.profileTitle}>
            {meta.siteTitle}
          </h1>
          {span ? <p className={styles.profileYear}>{span}</p> : null}
          {meta.tagline ? <p className={styles.tagline}>{meta.tagline}</p> : null}
          <p className={styles.profileFoot}>
            {formatNumber(totals.count)} 次徒步 ·{' '}
            {formatDistanceKm(totals.distanceKm)} km · 最高到达{' '}
            {formatAltitude(totals.altitudeMaxM)}
          </p>
        </div>
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>首次徒步</dt>
          <dd title={totals.firstDate ?? ''}>{dotDate(totals.firstDate)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>最近一次</dt>
          <dd title={totals.lastDate ?? ''}>{dotDate(totals.lastDate)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>徒步活跃日</dt>
          <dd>{formatNumber(totals.activeDays)} 天</dd>
        </div>
        <div className={styles.fact}>
          <dt>最长连续</dt>
          <dd>{formatNumber(totals.longestStreak)} 天</dd>
        </div>
      </dl>
    </section>
  );
};

export default Profile;
