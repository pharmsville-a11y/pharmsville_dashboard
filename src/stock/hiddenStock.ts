type HiddenStockFields = {
  itemCode?: string | null
  itemName?: string | null
  optionName?: string | null
  category1?: string | null
  category2?: string | null
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

export function isHiddenStockRow(row: HiddenStockFields): boolean {
  const category1 = compact(row.category1 ?? '')
  const category2 = compact(row.category2 ?? '')
  if (category1 === '부자재' || category2 === '부자재') return true

  const hay = compact(
    [row.itemCode, row.itemName, row.optionName, row.category1, row.category2].filter(Boolean).join(' '),
  )

  return hay.includes('부자재') || hay.includes('박스추가')
}

export function filterVisibleStock<T extends HiddenStockFields>(rows: T[]): T[] {
  return rows.filter((row) => !isHiddenStockRow(row))
}
