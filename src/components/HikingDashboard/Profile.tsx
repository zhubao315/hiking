import { useMemo } from 'react';
import SectionHeader from './SectionHeader';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import BrandMark from '@/components/BrandMark';
import SportIcon from '@/components/SportIcon';
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
  const sportKey = meta.siteUrl.replace(/\/$/, '').split('/').pop() ?? '';

  return (
    <section className={styles.profile} aria-labelledby="profile-title">
      <SectionHeader index="01" kicker="HIKING & OUTDOOR EXPLORATION" title="个人徒步档案" />
      <div className={styles.profileIdentity}>
        <div className={styles.brandBlock}>
          <BrandMark size={40} className={styles.brandMark} />
          <span className={styles.brandLabel}>
            <SportIcon name={sportKey} size={14} className={styles.brandIcon} />
            <span>ZB ACTIVE / {sportKey.toUpperCase()}</span>
          </span>
          {totals.lastDate ? (
            <span className={styles.brandStamp}>数据截至 {dotDate(totals.lastDate)}</span>
          ) : null}
        </div>
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
