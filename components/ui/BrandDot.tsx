import { brandOf } from "@/lib/reference/propertyReference";
import { BRAND_COLOR } from "@/lib/design/tokens";

// Small brand-colour swatch (2026-09-10) — for wherever a property or brand
// is named as text (filter options, table headers, tab pills) rather than
// drawn as a chart series, so brand identity is consistent dashboard-wide.
export default function BrandDot({
  property,
  brand,
  className = "",
}: {
  /** property code — its brand's colour is used */
  property?: string;
  /** or a brand name directly */
  brand?: string;
  className?: string;
}) {
  const key = brand ?? (property ? brandOf(property) : undefined);
  const color = key ? BRAND_COLOR[key] : undefined;
  if (!color) return null;
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ background: color }}
    />
  );
}
