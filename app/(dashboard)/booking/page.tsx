import {
  getBookingStats,
  getRoomNightsGap,
  getRepeatBookingShare,
  getRoomFormatStats,
  getExpatStats,
  getCancellationStats,
  getCancellationLeadTime,
  getCategoryMix,
  getGuestServedAccuracyCheck,
} from "@/lib/bigquery/queries/guestDetail";
import {
  getB2bContractRanking,
  getB2bTopAdrContracts,
  getCorporateAccountRetention,
  summarizeB2bContracts,
  resolveB2bFy,
} from "@/lib/bigquery/queries/b2bContracts";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import { resolveFilter } from "@/lib/bigquery/queries/filters";
import BookingContent from "@/components/booking/BookingContent";

export default async function BookingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);
  const resolved = resolveFilter(filter);
  const b2bFy = resolveB2bFy(filter);

  const [
    bookingStats,
    roomNightsGap,
    repeatBookingShare,
    roomFormatStats,
    expatStats,
    cancellationStats,
    cancellationLeadTime,
    categoryMix,
    b2bRanking,
    b2bTopAdr,
    b2bRetention,
    guestServedAccuracy,
  ] = await Promise.all([
    getBookingStats(filter),
    getRoomNightsGap(filter),
    getRepeatBookingShare(filter),
    getRoomFormatStats(filter),
    getExpatStats(filter),
    getCancellationStats(filter),
    getCancellationLeadTime(filter),
    getCategoryMix(filter),
    getB2bContractRanking(resolved.properties, b2bFy),
    getB2bTopAdrContracts(resolved.properties, b2bFy),
    getCorporateAccountRetention(resolved.properties),
    getGuestServedAccuracyCheck(),
  ]);

  return (
    <BookingContent
      bookingStats={bookingStats}
      roomNightsGap={roomNightsGap}
      repeatBookingShare={repeatBookingShare}
      roomFormatStats={roomFormatStats}
      expatStats={expatStats}
      cancellationStats={cancellationStats}
      cancellationLeadTime={cancellationLeadTime}
      categoryMix={categoryMix}
      b2bRanking={b2bRanking}
      b2bContractSummary={summarizeB2bContracts(b2bRanking)}
      b2bTopAdr={b2bTopAdr}
      b2bRetention={b2bRetention}
      guestServedAccuracy={guestServedAccuracy}
    />
  );
}
