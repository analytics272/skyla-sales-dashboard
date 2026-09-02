import { getBrandOccupancy } from "@/lib/bigquery/queries/brandCategory";
import { getBusinessCategoryAdr } from "@/lib/bigquery/queries/trends";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import BrandContent from "@/components/brand/BrandContent";

export default async function BrandPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const [brandOccupancy, categoryAdr] = await Promise.all([
    getBrandOccupancy(filter),
    getBusinessCategoryAdr(filter),
  ]);

  return <BrandContent brandOccupancy={brandOccupancy} categoryAdr={categoryAdr} />;
}
