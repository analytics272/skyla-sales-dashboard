export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

export default function Table<T>({
  columns,
  rows,
  rowKey,
  footerRow,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Rendered as a <tfoot> row using the same columns, so a totals/grand-total row always lines up under its header — never a separate ad-hoc row. */
  footerRow?: T;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`whitespace-nowrap px-2 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-2 py-2 text-zinc-700 dark:text-zinc-300 ${
                    col.align === "right" ? "text-right tabular-nums" : "text-left"
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-2 py-6 text-center text-zinc-400 dark:text-zinc-600">
                No data for this selection.
              </td>
            </tr>
          )}
        </tbody>
        {footerRow && (
          <tfoot>
            <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-2 py-2 text-zinc-900 dark:text-zinc-100 ${
                    col.align === "right" ? "text-right tabular-nums" : "text-left"
                  }`}
                >
                  {col.render(footerRow)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
