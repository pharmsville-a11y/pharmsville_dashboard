import type { GridRowStatus } from '../../components/page-test/grid/types'
import type { PlusclSnapshot, PlusclStockRow } from '../../services/queryPluscl'
import { filterVisibleStock } from '../../stock/hiddenStock'
import { resolveStockBrand } from '../../stock/brands'

const CATEGORY_OPTIONS = ['일반', '프로모션', '시즌', '단종예정', '검수중']

export type PageTestGridRow = {
  id: string
  groupId: string
  groupLabel: string
  sku: string
  name: string
  brand: string
  status: GridRowStatus
  progress: number
  trend: number[]
  thumbnail: string
  qty: number
  expireDate: string
  remainingDays: number | null
  warehouse: string
  category: string
  note: string
}

function sparkTrendFromId(id: string, len = 7): number[] {
  let seed = 0
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0
  return Array.from({ length: len }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return 20 + (seed % 80)
  })
}

function statusFromRemaining(remaining: number | null): GridRowStatus {
  if (remaining == null) return 'approved'
  if (remaining <= 7) return 'draft'
  if (remaining <= 30) return 'in_progress'
  return 'approved'
}

function progressFromRow(row: PlusclStockRow): number {
  if (row.remainingDays == null || row.shelfLife <= 0) return 48
  const used = Math.max(0, row.shelfLife - row.remainingDays)
  return Math.round(Math.max(0, Math.min(100, (used / row.shelfLife) * 100)))
}

function thumbnailLabel(name: string): string {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, '').trim()
  return cleaned.slice(0, 2) || '—'
}

export function pageTestCategoryOptions(): string[] {
  return [...CATEGORY_OPTIONS]
}

export function buildPageTestGridRows(snapshot: PlusclSnapshot): PageTestGridRow[] {
  return filterVisibleStock(snapshot.stock)
    .map((row) => {
      const brand = resolveStockBrand(row)
      return {
        id: `${row.itemCode}|${row.lotNo}|${row.expireDate ?? 'na'}`,
        groupId: brand.id,
        groupLabel: brand.name,
        sku: row.itemCode,
        name: row.itemName,
        brand: brand.name,
        status: statusFromRemaining(row.remainingDays),
        progress: progressFromRow(row),
        trend: sparkTrendFromId(row.itemCode),
        thumbnail: thumbnailLabel(row.itemName),
        qty: row.qty,
        expireDate: row.expireDate || '—',
        remainingDays: row.remainingDays,
        warehouse: row.warehouse || '—',
        category: row.category1 && row.category1 !== '미정' ? row.category1 : '일반',
        note: row.optionName || '',
      }
    })
    .sort((left, right) => left.groupLabel.localeCompare(right.groupLabel, 'ko') || left.name.localeCompare(right.name, 'ko'))
}
