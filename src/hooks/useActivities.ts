import { locationForRun, periodTitleForRun } from '@/utils/utils';
import activities from '@/static/activities.json';

// Same pattern as RUNNING and CYCLING: the activity file is static for the
// lifetime of the bundle, so aggregate once at module load instead of folding
// every record on each of the 10+ useActivities() calls per render.
const build = () => {
  const cities: Record<string, number> = {};
  const runPeriod: Record<string, number> = {};
  const provinces: Set<string> = new Set();
  const countries: Set<string> = new Set();
  const years: Set<string> = new Set();

  activities.forEach((run) => {
    const location = locationForRun(run);

    const periodName = periodTitleForRun(run);
    if (periodName) {
      runPeriod[periodName] = runPeriod[periodName]
        ? runPeriod[periodName] + 1
        : 1;
    }

    const { city, province, country } = location;
    // drop only one char city
    if (city.length > 1) {
      cities[city] = cities[city] ? cities[city] + run.distance : run.distance;
    }
    if (province) provinces.add(province);
    if (country) countries.add(country);
    years.add(run.start_date_local.slice(0, 4));
  });

  const yearsArray = [...years].sort().reverse();
  const thisYear = yearsArray[0] ?? '';

  return {
    activities,
    years: yearsArray,
    countries: [...countries],
    provinces: [...provinces],
    cities,
    runPeriod,
    thisYear,
  };
};

const cache = build();

const useActivities = () => cache;

export default useActivities;
