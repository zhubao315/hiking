import { useMemo } from 'react';
import useSiteMetadata from '@/hooks/useSiteMetadata';
import SportIcon from '@/components/SportIcon';
import { computeTotals, formatNumber, type RunRecord } from '@/utils/hikingStats';
import styles from './style.module.css';

interface IProfileProps {
  runs: RunRecord[];
}

/**
 * Compact mountain archive. Distance / altitude / count are CoreMetrics'
 * job; this strip carries identity + span + consistency signals only.
 */
const Profile = ({ runs }: IProfileProps) => {
  const meta = useSiteMetadata();
  const totals = useMemo(() => computeTotals(runs), [runs]);

  const firstYear = totals.firstDate?.slice(0, 4) ?? '';
  const lastYear = totals.lastDate?.slice(0, 4) ?? '';
  const span = firstYear && lastYear ? `${firstYear}—${lastYear}` : '—';
  const sportKey = meta.siteUrl.replace(/\/$/, '').split('/').pop() ?? '';

  return (
    <section className={styles.profile} aria-labelledby="profile-title">
      <div className={styles.identity}>
        <SportIcon name={sportKey} size={24} className={styles.sportIcon} />
        <div className={styles.identityText}>
          <p className={styles.eyebrow}>{sportKey.toUpperCase()} / PERSONAL ARCHIVE</p>
          <h1 id="profile-title" className={styles.profileTitle}>徒步与山野</h1>
          {meta.tagline ? <p className={styles.tagline}>{meta.tagline}</p> : null}
        </div>
      </div>
      <dl className={styles.metaTags}>
        <div className={styles.metaTag}>
          <dt>记录跨度</dt>
          <dd>{span}</dd>
        </div>
        <div className={styles.metaTag}>
          <dt>徒步活跃日</dt>
          <dd>{formatNumber(totals.activeDays)} 天</dd>
        </div>
        <div className={styles.metaTag}>
          <dt>最长连续</dt>
          <dd>{formatNumber(totals.longestStreak)} 天</dd>
        </div>
      </dl>
    </section>
  );
};

export default Profile;
