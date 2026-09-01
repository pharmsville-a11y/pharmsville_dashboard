export type GridDensity = 'compact' | 'standard' | 'comfortable'

export type GridRowStatus = 'draft' | 'in_progress' | 'approved'

export type SortDirection = 'asc' | 'desc'

export type SortRule = {
  columnId: string
  direction: SortDirection
}

export type PinSide = 'left' | 'right' | null

export type FilterOperator = 'contains' | 'equals' | 'gte' | 'lte'

export type FilterCondition = {
  id: string
  columnId: string
  operator: FilterOperator
  value: string
}

export type ColumnKind =
  | 'text'
  | 'number'
  | 'status'
  | 'progress'
  | 'sparkline'
  | 'thumbnail'
  | 'editable-text'
  | 'editable-select'

export type GridColumnDef<TRow> = {
  id: string
  label: string
  width: number
  minWidth?: number
  kind: ColumnKind
  pin?: PinSide
  sortable?: boolean
  defaultVisible?: boolean
  options?: string[]
  getValue: (row: TRow) => string | number | GridRowStatus | number[] | null | undefined
  getSortValue?: (row: TRow) => string | number
}

export const GRID_DENSITY_LABEL: Record<GridDensity, string> = {
  compact: 'Compact',
  standard: 'Standard',
  comfortable: 'Comfortable',
}

export const STATUS_LABEL: Record<GridRowStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  approved: 'Approved',
}
