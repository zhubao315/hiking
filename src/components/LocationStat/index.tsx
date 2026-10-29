import YearStat from '@/components/YearStat';
import {
  CHINESE_LOCATION_INFO_MESSAGE_FIRST,
  CHINESE_LOCATION_INFO_MESSAGE_SECOND,
} from '@/utils/const';
import CitiesStat from './CitiesStat';
import LocationSummary from './LocationSummary';
import PeriodStat from './PeriodStat';

interface ILocationStatProps {
  changeYear: (_year: string) => void;
  changeCity: (_city: string) => void;
  changePeriod: (_period: string) => void;
}

const LocationStat = ({
  changeYear,
  changeCity,
  changePeriod,
}: ILocationStatProps) => (
  <div className="w-full pb-2">
    <section className="pb-0">
      <p className="leading-relaxed">
        {CHINESE_LOCATION_INFO_MESSAGE_FIRST}
        .
        <br />
        {CHINESE_LOCATION_INFO_MESSAGE_SECOND}
        .
        <br />
        <br />
        Yesterday you said tomorrow.
      </p>
    </section>
    <hr />
    <LocationSummary />
    <CitiesStat onClick={changeCity} />
    <PeriodStat onClick={changePeriod} />
    <YearStat year="Total" onClick={changeYear} />
  </div>
);

export default LocationStat;
