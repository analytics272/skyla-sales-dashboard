import { getBrandOccupancy, getCategoryRevenueByFy } from "@/lib/bigquery/queries/brandCategory";
import { parseKpiFilter, SearchParams } from "@/lib/filters/parseSearchParams";
import BrandContent from "@/components/brand/BrandContent";

export default async function BrandPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filter = parseKpiFilter(sp);

  const [brandOccupancy, categoryRevenueByFy] = await Promise.all([
    getBrandOccupancy(filter),
    getCategoryRevenueByFy({ properties: filter.properties }),
  ]);

  return <BrandContent brandOccupancy={brandOccupancy} categoryRevenueByFy={categoryRevenueByFy} />;
}
