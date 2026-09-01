export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadChartImage(container: HTMLElement | null, filename: string) {
  if (!container) return
  const svg = container.querySelector('svg.recharts-surface') ?? container.querySelector('svg')
  if (!svg) return

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const rect = svg.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(svgBlob)
  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const pngUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = pngUrl
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')
    URL.revokeObjectURL(url)
  }
  image.src = url
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const lines: string[] = []
    let current = words[0]
    for (let index = 1; index < words.length; index += 1) {
      const next = `${current} ${words[index]}`
      if (ctx.measureText(next).width <= maxWidth) {
        current = next
        continue
      }
      lines.push(current)
      current = words[index]
    }
    lines.push(current)
    return lines
  }

  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const next = current + char
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = char
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawTreemapLabels(
  ctx: CanvasRenderingContext2D,
  container: HTMLElement,
  offsetX = 0,
  offsetY = 0,
) {
  const containerRect = container.getBoundingClientRect()
  const labelBoxes = container.querySelectorAll<HTMLElement>('.pt-product-treemap__label-box')

  for (const box of labelBoxes) {
    const boxRect = box.getBoundingClientRect()
    const left = boxRect.left - containerRect.left + offsetX
    const top = boxRect.top - containerRect.top + offsetY
    const width = boxRect.width
    const height = boxRect.height
    const fontSize = Number.parseFloat(getComputedStyle(box).fontSize) || 12
    const lineHeight = fontSize * 1.28
    const isDark = box.classList.contains('pt-product-treemap__cell--dark')

    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a'
    ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
    ctx.textBaseline = 'top'

    const labelEl = box.querySelector<HTMLElement>('.pt-product-treemap__label')
    const shareEl = box.querySelector<HTMLElement>('.pt-product-treemap__share')
    const shareBand = shareEl ? fontSize + 2 : 0
    const labelHeight = Math.max(0, height - shareBand)
    const maxLines = Math.max(1, Math.floor(labelHeight / lineHeight))

    if (labelEl && !labelEl.classList.contains('pt-product-treemap__label--empty') && labelEl.textContent) {
      const lines = wrapCanvasText(ctx, labelEl.textContent.trim(), width).slice(0, maxLines)
      lines.forEach((line, index) => {
        ctx.fillText(line, left, top + index * lineHeight)
      })
    }

    if (shareEl?.textContent) {
      ctx.fillText(shareEl.textContent, left, top + height - fontSize)
    }
  }
}

function drawDomText(ctx: CanvasRenderingContext2D, element: HTMLElement, rootRect: DOMRect) {
  const text = element.textContent?.trim()
  if (!text) return
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  ctx.fillStyle = style.color
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  ctx.textBaseline = 'top'
  ctx.fillText(text, rect.left - rootRect.left, rect.top - rootRect.top)
}

function drawTreemapLegend(ctx: CanvasRenderingContext2D, captureRoot: HTMLElement, rootRect: DOMRect) {
  const items = captureRoot.querySelectorAll<HTMLElement>('.pt-product-treemap__legend li')
  for (const item of items) {
    const dot = item.querySelector<HTMLElement>('.pt-legend__dot')
    const name = item.querySelector<HTMLElement>('.pt-product-treemap__legend-name')
    const share = item.querySelector<HTMLElement>('strong')
    if (dot) {
      const dotRect = dot.getBoundingClientRect()
      const radius = dotRect.width / 2
      ctx.fillStyle = getComputedStyle(dot).backgroundColor || '#6c5ce7'
      ctx.beginPath()
      ctx.arc(
        dotRect.left - rootRect.left + radius,
        dotRect.top - rootRect.top + radius,
        radius,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }

    if (name?.textContent) {
      const nameRect = name.getBoundingClientRect()
      const style = getComputedStyle(name)
      ctx.fillStyle = style.color
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      ctx.textBaseline = 'top'
      ctx.fillText(name.textContent.trim(), nameRect.left - rootRect.left, nameRect.top - rootRect.top)
    }

    if (share?.textContent) {
      const shareRect = share.getBoundingClientRect()
      const style = getComputedStyle(share)
      ctx.fillStyle = style.color
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(share.textContent.trim(), shareRect.right - rootRect.left, shareRect.top - rootRect.top)
      ctx.textAlign = 'left'
    }
  }
}

function drawTreemapHeader(ctx: CanvasRenderingContext2D, captureRoot: HTMLElement, rootRect: DOMRect) {
  for (const selector of [
    '.pt-product-treemap__eyebrow',
    '#pt-product-treemap-title',
    '.pt-product-treemap__meta',
  ]) {
    const element = captureRoot.querySelector<HTMLElement>(selector)
    if (element) drawDomText(ctx, element, rootRect)
  }
}

export function downloadTreemapImage(
  captureRoot: HTMLElement | null,
  chartContainer: HTMLElement | null,
  filename: string,
) {
  if (!captureRoot || !chartContainer) return
  const svg = chartContainer.querySelector('svg.recharts-surface') ?? chartContainer.querySelector('svg')
  if (!svg) return

  const tooltip = chartContainer.querySelector<HTMLElement>('.pt-product-treemap__tooltip')
  const tooltipVisibility = tooltip?.style.visibility
  if (tooltip) tooltip.style.visibility = 'hidden'

  const prevScrollTop = captureRoot.scrollTop
  captureRoot.scrollTop = 0

  const rootRect = captureRoot.getBoundingClientRect()
  const chartRect = chartContainer.getBoundingClientRect()
  const width = Math.max(1, Math.round(rootRect.width))
  const height = Math.max(1, Math.round(captureRoot.scrollHeight))
  const chartLeft = chartRect.left - rootRect.left
  const chartTop = chartRect.top - rootRect.top
  const chartWidth = Math.max(1, Math.round(chartRect.width))
  const chartHeight = Math.max(1, Math.round(chartRect.height))

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(chartWidth))
  clone.setAttribute('height', String(chartHeight))

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(svgBlob)
  const image = new Image()
  const restoreTooltip = () => {
    if (tooltip) tooltip.style.visibility = tooltipVisibility ?? ''
    captureRoot.scrollTop = prevScrollTop
  }

  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      restoreTooltip()
      URL.revokeObjectURL(url)
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    drawTreemapHeader(ctx, captureRoot, rootRect)
    ctx.drawImage(image, chartLeft, chartTop, chartWidth, chartHeight)
    drawTreemapLabels(ctx, chartContainer, chartLeft, chartTop)
    drawTreemapLegend(ctx, captureRoot, rootRect)

    canvas.toBlob((blob) => {
      restoreTooltip()
      if (!blob) return
      const pngUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = pngUrl
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')
    URL.revokeObjectURL(url)
  }
  image.onerror = () => {
    restoreTooltip()
    URL.revokeObjectURL(url)
  }
  image.src = url
}
