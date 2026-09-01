import { Workbook } from 'exceljs'
import type { FilterCondition, GridColumnDef, SortRule } from './types'

export function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''), 'ko')
}

export function sortRows<TRow>(rows: TRow[], rules: SortRule[], columns: GridColumnDef<TRow>[]): TRow[] {
  if (rules.length === 0) return rows
  const copy = [...rows]
  copy.sort((left, right) => {
    for (const rule of rules) {
      const column = columns.find((item) => item.id === rule.columnId)
      if (!column) continue
      const a = column.getSortValue ? column.getSortValue(left) : column.getValue(left)
      const b = column.getSortValue ? column.getSortValue(right) : column.getValue(right)
      const compared = compareValues(a, b)
      if (compared !== 0) return rule.direction === 'asc' ? compared : -compared
    }
    return 0
  })
  return copy
}

export function filterRows<TRow>(rows: TRow[], conditions: FilterCondition[], columns: GridColumnDef<TRow>[]): TRow[] {
  if (conditions.length === 0) return rows
  return rows.filter((row) =>
    conditions.every((condition) => {
      if (!condition.value.trim()) return true
      const column = columns.find((item) => item.id === condition.columnId)
      if (!column) return true
      const raw = column.getValue(row)
      const value = String(raw ?? '').toLowerCase()
      const needle = condition.value.trim().toLowerCase()
      const num = Number(condition.value)
      if (condition.operator === 'equals') return value === needle
      if (condition.operator === 'gte') return Number(raw) >= num
      if (condition.operator === 'lte') return Number(raw) <= num
      return value.includes(needle)
    }),
  )
}

export function downloadGridCsv<TRow>(filename: string, rows: TRow[], columns: GridColumnDef<TRow>[]) {
  const header = columns.map((column) => column.label).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = column.getValue(row)
          const text = Array.isArray(raw) ? raw.join('|') : String(raw ?? '')
          return `"${text.replace(/"/g, '""')}"`
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function downloadGridExcel<TRow>(filename: string, rows: TRow[], columns: GridColumnDef<TRow>[]) {
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet('data')
  sheet.addRow(columns.map((column) => column.label))
  for (const row of rows) {
    sheet.addRow(
      columns.map((column) => {
        const raw = column.getValue(row)
        if (Array.isArray(raw)) return raw.join('|')
        return raw ?? ''
      }),
    )
  }
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function pageSlice<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize))
}
