import {
  getBookingStats,
  getRoomNightsGap,
  getRepeatBookingShare,
  getRoomFormatStats,
  getRoomFormatByFy,
  getExpatStats,
  getCancellationStats,
  getCancellationLeadTime,
} from "@/lib/bigquery/queries/guestDetail";
import {
  getB2bContractRanking,
  getB2bTopAdrContracts,
  getCorporateAccountRetention,
  summarizeB2bContracts,
} from "@/lib/bigquery/queries/b2bContracts";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import BookingContent from "@/components/booking/BookingContent";

export default async function BookingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const resolved = resolveFilter(filter);

  const [
    bookingStats,
    roomNightsGap,
    repeatBookingShare,
    roomFormatStats,
    roomFormatByFy,
    expatStats,
    cancellationStats,
    cancellationLeadTime,
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
    getB2bContractRanking(resolved.properties, resolved.fys),
    getB2bTopAdrContracts(resolved.properties, resolved.fys),
    getCorporateAccountRetention(resolved.properties),
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
      b2bRanking={b2bRanking}
      b2bContractSummary={summarizeB2bContracts(b2bRanking)}
      b2bTopAdr={b2bTopAdr}
      b2bRetention={b2bRetention}
    />
  );
}
