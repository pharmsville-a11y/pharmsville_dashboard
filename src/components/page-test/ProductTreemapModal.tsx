import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type MutableRefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { ImageDown, X } from 'lucide-react'
import { Treemap } from 'recharts'
import { formatWon } from '../../lib/format'
import type { SalesCategory, SalesDrillRow } from '../../pages/pageTest/plusclDashboard'
import { downloadTreemapImage } from './chartExport'
import './page-test.css'

type TreemapLeaf = {
  name: string
  sales: number
  share: number
  sku: string
  fill: string
}

type CellLayout = {
  x: number
  y: number
  width: number
  height: number
  leaf: TreemapLeaf
}

type TreemapHoverHandler = (leaf: TreemapLeaf | null, clientX: number, clientY: number) => void

type TreemapCellProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  sales?: number
  share?: number
  sku?: string
  depth?: number
  fill?: string
  index?: number
  value?: number
  payload?: TreemapLeaf
  root?: TreemapLeaf & { children?: unknown[] }
  layoutsRef?: MutableRefObject<Map<string, CellLayout>>
}

const TREEMAP_HEIGHT = 380
const TREEMAP_TOP_LIMIT = 10

const TREEMAP_PALETTE = [
  '#6c5ce7',
  '#00b894',
  '#0984e3',
  '#e17055',
  '#fdcb6e',
  '#a29bfe',
  '#55efc4',
  '#74b9ff',
  '#fab1a0',
  '#ffeaa7',
  '#81ecec',
  '#ff7675',
]

const treemapHoverRef: { current: TreemapHoverHandler | null } = { current: null }

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return null
  const value = Number.parseInt(normalized, 16)
  if (Number.isNaN(value)) return null
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.68
}

function treemapColor(index: number): string {
  return TREEMAP_PALETTE[index % TREEMAP_PALETTE.length]
}

function treemapTone(fill: string): 'light' | 'dark' {
  return isLightColor(fill) ? 'light' : 'dark'
}

function resolveCellData(props: TreemapCellProps): TreemapLeaf | null {
  const depth = Number(props.depth ?? 0)
  if (depth < 1) return null

  const root = props.root
  const payload = props.payload
  const skuRaw = props.sku ?? payload?.sku ?? root?.sku
  if (!skuRaw) return null

  const name = String(props.name ?? root?.name ?? payload?.name ?? '').trim()
  if (!name) return null

  const sales = Number(props.sales ?? root?.sales ?? payload?.sales ?? props.value ?? 0)
  const share = Number(props.share ?? root?.share ?? payload?.share ?? 0)
  const sku = String(skuRaw).trim()
  const fill = String(
    props.fill ?? root?.fill ?? payload?.fill ?? TREEMAP_PALETTE[Number(props.index ?? 0) % TREEMAP_PALETTE.length],
  )

  return {
    name,
    sales: Number.isFinite(sales) ? sales : 0,
    share: Number.isFinite(share) ? share : 0,
    sku,
    fill,
  }
}

function notifyHover(leaf: TreemapLeaf | null, event: MouseEvent<SVGRectElement>) {
  treemapHoverRef.current?.(leaf, event.clientX, event.clientY)
}

function ProductTreemapCell(props: TreemapCellProps) {
  const leaf = resolveCellData(props)
  const { x = 0, y = 0, width = 0, height = 0, depth = 0, layoutsRef } = props

  if (!leaf || depth < 1 || !Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    return null
  }

  layoutsRef?.current.set(leaf.sku, { x, y, width, height, leaf })

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={leaf.fill} stroke="#fff" strokeWidth={2} rx={2} />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        pointerEvents="all"
        onMouseEnter={(event) => notifyHover(leaf, event)}
        onMouseMove={(event) => notifyHover(leaf, event)}
      />
    </g>
  )
}

function ProductTreemapLabelLayer({
  layoutsRef,
}: {
  layoutsRef: MutableRefObject<Map<string, CellLayout>>
}) {
  const layouts = [...layoutsRef.current.values()]

  return (
    <div className="pt-product-treemap__labels" aria-hidden="true">
      {layouts.map((cell) => {
        const { leaf, x, y, width, height } = cell
        const innerPad = 6
        const innerW = Math.max(0, width - innerPad * 2)
        const innerH = Math.max(0, height - innerPad * 2)
        if (innerW < 12 || innerH < 14) return null

        const fontSize = Math.min(13, Math.max(11, width / 10))
        const shareFontSize = 12
        const showShare = innerH > 50 && leaf.share > 0
        const shareBand = showShare ? shareFontSize + 4 : 0
        const labelH = Math.max(0, innerH - shareBand)
        const lineHeight = fontSize * 1.28
        const maxLines = Math.max(1, Math.floor(labelH / lineHeight))
        const tone = treemapTone(leaf.fill)
        const showName = innerW >= 24 && labelH >= lineHeight

        return (
          <div
            key={leaf.sku}
            className={`pt-product-treemap__label-box pt-product-treemap__cell--${tone}`}
            style={{
              left: x + innerPad,
              top: y + innerPad,
              width: innerW,
              height: innerH,
              fontSize: `${fontSize}px`,
            }}
          >
            {showName ? (
              <div
                className="pt-product-treemap__label"
                style={{ WebkitLineClamp: maxLines, lineHeight: 1.28 }}
              >
                {leaf.name}
              </div>
            ) : (
              <div className="pt-product-treemap__label pt-product-treemap__label--empty" />
            )}
            {showShare ? <div className="pt-product-treemap__share">{leaf.share.toFixed(1)}%</div> : null}
          </div>
        )
      })}
    </div>
  )
}

function ProductTreemapTooltip({
  leaf,
  left,
  top,
}: {
  leaf: TreemapLeaf
  left: number
  top: number
}) {
  return (
    <div className="pt-chart-tooltip pt-product-treemap__tooltip" style={{ left, top }} role="tooltip">
      <p className="pt-chart-tooltip__label">{leaf.name}</p>
      <p>{formatWon(leaf.sales)}</p>
      <p>{leaf.share.toFixed(1)}%</p>
    </div>
  )
}

const ProductTreemapChart = forwardRef<HTMLDivElement, { treeData: Array<Record<string, unknown>> }>(
  function ProductTreemapChart({ treeData }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutsRef = useRef(new Map<string, CellLayout>())
  const layoutPassRef = useRef('')
  const [chartWidth, setChartWidth] = useState(0)
  const [tooltip, setTooltip] = useState<{ leaf: TreemapLeaf; left: number; top: number } | null>(null)

  const layoutPass = `${chartWidth}:${treeData.length}:${String(treeData[0]?.name ?? '')}`
  if (layoutPassRef.current !== layoutPass) {
    layoutPassRef.current = layoutPass
    layoutsRef.current.clear()
  }

  const renderTreemapCell = useCallback(
    (props: TreemapCellProps) => <ProductTreemapCell {...props} layoutsRef={layoutsRef} />,
    [],
  )

  useEffect(() => {
    treemapHoverRef.current = (leaf, clientX, clientY) => {
      const container = containerRef.current
      if (!container || !leaf) {
        setTooltip(null)
        return
      }

      const rect = container.getBoundingClientRect()
      const tooltipW = 220
      const tooltipH = 72
      let left = clientX - rect.left + 12
      let top = clientY - rect.top + 12
      left = Math.min(Math.max(8, left), Math.max(8, rect.width - tooltipW))
      top = Math.min(Math.max(8, top), Math.max(8, rect.height - tooltipH))
      setTooltip({ leaf, left, top })
    }
    return () => {
      treemapHoverRef.current = null
    }
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    function measure() {
      const nextWidth = Math.floor(element?.getBoundingClientRect().width ?? 0)
      if (nextWidth > 0) setChartWidth(nextWidth)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  return (
    <div
      ref={setContainerRef}
      className="pt-product-treemap"
      style={{ height: TREEMAP_HEIGHT }}
      onMouseLeave={() => setTooltip(null)}
    >
      {chartWidth > 0 ? (
        <>
          <Treemap
            width={chartWidth}
            height={TREEMAP_HEIGHT}
            data={treeData}
            dataKey="sales"
            aspectRatio={4 / 3}
            stroke="#fff"
            isAnimationActive={false}
            isUpdateAnimationActive={false}
            content={renderTreemapCell as never}
          />
          <ProductTreemapLabelLayer layoutsRef={layoutsRef} />
        </>
      ) : (
        <div className="pt-product-treemap__placeholder" style={{ height: TREEMAP_HEIGHT }} />
      )}
      {tooltip ? <ProductTreemapTooltip leaf={tooltip.leaf} left={tooltip.left} top={tooltip.top} /> : null}
    </div>
  )
},
)

export function ProductTreemapModal({
  category,
  products,
  onClose,
}: {
  category: SalesCategory | null
  products: SalesDrillRow[]
  onClose: () => void
}) {
  const exportRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!category) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('is-pt-modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-pt-modal-open')
    }
  }, [category, onClose])

  const topProducts = useMemo(() => {
    const sorted = [...products].sort((left, right) => right.sales - left.sales).slice(0, TREEMAP_TOP_LIMIT)
    const total = sorted.reduce((sum, row) => sum + row.sales, 0)
    return sorted.map((row) => ({
      ...row,
      share: total > 0 ? (row.sales / total) * 100 : 0,
    }))
  }, [products])

  const legendLeaves = useMemo<TreemapLeaf[]>(
    () =>
      topProducts.map((row, index) => ({
        name: row.name,
        sales: row.sales,
        share: row.share,
        sku: row.sku,
        fill: treemapColor(index),
      })),
    [topProducts],
  )

  const treeData = useMemo(() => {
    if (!category || legendLeaves.length === 0) return []
    return [
      {
        name: category.name,
        sales: legendLeaves.reduce((sum, row) => sum + row.sales, 0),
        children: legendLeaves.map((row) => ({ ...row })),
      },
    ]
  }, [category, legendLeaves])

  if (!category || topProducts.length === 0) return null

  const panelStyle = { '--treemap-accent': '#6c5ce7' } as CSSProperties
  const safeName = category.name.replace(/[\\/:*?"<>|]/g, '_')

  function handleDownloadImage() {
    downloadTreemapImage(exportRef.current, chartRef.current, `treemap-${safeName}.png`)
  }

  return createPortal(
    <div className="pt-modal" role="presentation" onClick={onClose}>
      <div
        className="pt-modal__panel pt-modal__panel--treemap"
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pt-product-treemap-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pt-modal__head-actions pt-modal__head-actions--treemap">
          <button
            type="button"
            className="pt-modal__close"
            aria-label="이미지 다운로드"
            onClick={handleDownloadImage}
            style={{ display: 'none'}}>
            <ImageDown size={18} />
          </button>
          <button type="button" className="pt-modal__close" aria-label="닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div ref={exportRef} className="pt-product-treemap__capture">
          <p className="pt-product-treemap__eyebrow">상위 {TREEMAP_TOP_LIMIT}개 제품 비중</p>
          <h3 id="pt-product-treemap-title">{category.name}</h3>
          <p className="pt-product-treemap__meta">
            최근 30일 · {formatWon(category.sales)} · 전체 {category.share.toFixed(1)}%
          </p>

          <ProductTreemapChart ref={chartRef} treeData={treeData} />

          <ul className="pt-product-treemap__legend">
            {legendLeaves.map((leaf) => (
              <li key={leaf.sku}>
                <span className="pt-legend__dot" style={{ background: leaf.fill }} />
                <span className="pt-product-treemap__legend-name" title={leaf.name}>
                  {leaf.name}
                </span>
                <strong>{leaf.share.toFixed(1)}%</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  )
}
