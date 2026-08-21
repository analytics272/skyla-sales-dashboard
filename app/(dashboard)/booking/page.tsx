import {
  getBookingStats,
  getRoomNightsGap,
  getRepeatBookingShare,
  getRoomFormatStats,
  getRoomFormatByFy,
  getExpatStats,
  getCancellationStats,
  getCancellationLeadTime,
  getB2bByCompany,
} from "@/lib/bigquery/queries/guestDetail";
import {
  getB2bContractRanking,
  getB2bTopAdrContracts,
  getCorporateAccountRetention,
} from "@/lib/bigquery/queries/b2bContracts";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import BookingContent from "@/components/booking/BookingContent";

export default async function BookingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const [
    bookingStats,
    roomNightsGap,
    repeatBookingShare,
    roomFormatStats,
    roomFormatByFy,
    expatStats,
    cancellationStats,
    cancellationLeadTime,
    b2bByCompany,
    b2bRanking,
    b2bTopAdr,
    b2bRetention,
  ] = await Promise.all([
    getBookingStats(filter),
    getRoomNightsGap(filter),
    getRepeatBookingShare(filter),
    getRoomFormatStats(filter),
    getRoomFormatByFy({ properties: filter.properties }),
    getExpatStats(filter),
    getCancellationStats(filter),
    getCancellationLeadTime(filter),
    getB2bByCompany({ properties: filter.properties, fys: filter.fys }),
    getB2bContractRanking(filter.fys),
    getB2bTopAdrContracts(filter.fys),
    getCorporateAccountRetention(),
  ]);

  return (
    <BookingContent
      bookingStats={bookingStats}
      roomNightsGap={roomNightsGap}
      repeatBookingShare={repeatBookingShare}
      roomFormatStats={roomFormatStats}
      roomFormatByFy={roomFormatByFy}
      expatStats={expatStats}
      cancellationStats={cancellationStats}
      cancellationLeadTime={cancellationLeadTime}
      b2bByCompany={b2bByCompany}
      b2bRanking={b2bRanking}
      b2bTopAdr={b2bTopAdr}
      b2bRetention={b2bRetention}
    />
  );
}
