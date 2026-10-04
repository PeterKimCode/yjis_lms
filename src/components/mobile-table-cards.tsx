import { Children, isValidElement, type ReactNode } from "react"

type Cell = { children?: ReactNode; colSpan?: number; rowSpan?: number }
function cells(row: ReactNode) {
  if (!isValidElement<{ children?: ReactNode }>(row)) return null
  const items = Children.toArray(row.props.children)
  return items.every((item) => isValidElement<Cell>(item) && !item.props.colSpan && !item.props.rowSpan) ? items : null
}
export function canShowMobileCards(rows: ReactNode[], count: number) {
  return rows.every((row) => cells(row)?.length === count)
}
function headerText(header: ReactNode, index: number): ReactNode {
  if (typeof header === "string") return header
  if (isValidElement<{ label?: string; children?: ReactNode }>(header)) return header.props.label ?? header.props.children ?? `Field ${index + 1}`
  return `Field ${index + 1}`
}
export function MobileTableCards({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[] }) {
  return <div className="grid min-w-0 gap-3 md:hidden">{rows.map((row, index) => {
    const items = cells(row) ?? []
    return <article key={isValidElement(row) ? row.key ?? index : index} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="break-words font-semibold">{isValidElement<Cell>(items[0]) ? items[0].props.children : null}</h3>
      <dl className="mt-3 grid min-w-0 grid-cols-[minmax(0,6rem)_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">{items.slice(1).map((cell, position) => <div key={position} className="contents"><dt className="break-words text-slate-600">{headerText(headers[position + 1], position + 1)}</dt><dd className="min-w-0 break-words [overflow-wrap:anywhere] [&_form]:min-w-0 [&_button]:max-w-full">{isValidElement<Cell>(cell) ? cell.props.children : null}</dd></div>)}</dl>
    </article>
  })}</div>
}
