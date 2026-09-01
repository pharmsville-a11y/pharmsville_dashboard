import { Workbook, type Worksheet } from 'exceljs'
import { AD_PLATFORM_LABEL, AD_PRODUCT_LABEL } from '../ads'
import type { DateRangeKey } from '../adapters/types'
import { RANGE_LABELS } from '../adapters/utils'
import type { DashboardSnapshot } from '../services/types'
import { downloadWorkbook } from './excelTemplate'
import { formatHoursLabel } from './format'

const KIND_LABEL = {
  commerce: '커머스',
  sns: 'SNS',
  ads: '광고',
} as const

const WON = '#,##0'
const PCT = '0.00'

export type ExcelReportId = 'sales' | 'ads'

export const EXCEL_REPORTS: Array<{ id: ExcelReportId; label: string }> = [
  { id: 'sales', label: '매출 현황' },
  { id: 'ads', label: '광고 현황' },
]

function periodText(from: string, to: string) {
  return from === to ? from : `${from} ~ ${to}`
}

function reportFilename(kind: ExcelReportId, from: string, to: string) {
  const label = kind === 'sales' ? '매출현황' : '광고현황'
  const span = from === to ? from : `${from}_${to}`
  return `채널보드_${label}_${span}.xlsx`
}

function styleTitle(sheet: Worksheet, title: string) {
  sheet.mergeCells('A1:E1')
  sheet.getCell('A1').value = title
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1C1C28' } }
}

function writeMeta(
  sheet: Worksheet,
  input: {
    from: string
    to: string
    hours: number[] | null
    range: DateRangeKey
    source: DashboardSnapshot['dataSource']
  },
) {
  sheet.getCell('A2').value = '조회 기간'
  sheet.getCell('B2').value = periodText(input.from, input.to)
  sheet.getCell('A3').value = '시간대'
  sheet.getCell('B3').value = formatHoursLabel(input.hours)
  sheet.getCell('A4').value = '구간'
  sheet.getCell('B4').value = RANGE_LABELS[input.range]
  sheet.getCell('A5').value = '데이터'
  sheet.getCell('B5').value = input.source === 'live' ? '실측' : '가상'
  ;['A2', 'A3', 'A4', 'A5'].forEach((addr) => {
    sheet.getCell(addr).font = { bold: true }
  })
}

function writeHeaderRow(sheet: Worksheet, row: number, labels: string[]) {
  labels.forEach((label, index) => {
    const cell = sheet.getRow(row).getCell(index + 1)
    cell.value = label
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C5CE7' } }
  })
}

function wonCell(sheet: Worksheet, addr: string, value: number | null | undefined) {
  const cell = sheet.getCell(addr)
  if (typeof value === 'number' && Number.isFinite(value)) {
    cell.value = value
    cell.numFmt = WON
  } else {
    cell.value = null
  }
}

function pctCell(sheet: Worksheet, addr: string, value: number | null | undefined) {
  const cell = sheet.getCell(addr)
  if (typeof value === 'number' && Number.isFinite(value)) {
    cell.value = value
    cell.numFmt = PCT
  } else {
    cell.value = null
  }
}

function buildSalesWorkbook(input: {
  data: DashboardSnapshot
  range: DateRangeKey
  from: string
  to: string
  hours: number[] | null
}) {
  const { data } = input
  const workbook = new Workbook()
  workbook.creator = '채널보드'
  const sheet = workbook.addWorksheet('매출 현황')
  sheet.columns = [{ width: 18 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 12 }]

  styleTitle(sheet, '매출 현황')
  writeMeta(sheet, {
    from: input.from,
    to: input.to,
    hours: input.hours,
    range: input.range,
    source: data.dataSource,
  })

  const top = data.channels.find((channel) => channel.id === data.totals.topChannelId)
  const salesChannels = data.channels.filter((channel) => channel.kind !== 'ads')

  sheet.getCell('A7').value = '총매출'
  sheet.getCell('A7').font = { bold: true }
  wonCell(sheet, 'B7', data.totals.sales)
  sheet.getCell('A8').value = '매출 증감(%)'
  sheet.getCell('A8').font = { bold: true }
  pctCell(sheet, 'B8', data.totals.salesChangePct)
  sheet.getCell('A9').value = '톱 채널'
  sheet.getCell('A9').font = { bold: true }
  sheet.getCell('B9').value = top?.name ?? null
  sheet.getCell('A10').value = '톱 채널 값'
  sheet.getCell('A10').font = { bold: true }
  wonCell(sheet, 'B10', top?.primaryValue)

  writeHeaderRow(sheet, 12, ['채널', '구분', '값', '증감(%)'])
  salesChannels.forEach((channel, index) => {
    const row = 13 + index
    sheet.getCell(`A${row}`).value = channel.name
    sheet.getCell(`B${row}`).value = KIND_LABEL[channel.kind]
    if (channel.kind === 'sns') {
      sheet.getCell(`C${row}`).value = channel.primaryValue
      sheet.getCell(`C${row}`).numFmt = '#,##0'
    } else {
      wonCell(sheet, `C${row}`, channel.primaryValue)
    }
    pctCell(sheet, `D${row}`, channel.changePct)
  })

  return workbook
}

function buildAdsWorkbook(input: {
  data: DashboardSnapshot
  range: DateRangeKey
  from: string
  to: string
  hours: number[] | null
}) {
  const { data } = input
  const workbook = new Workbook()
  workbook.creator = '채널보드'
  const sheet = workbook.addWorksheet('광고 현황')
  sheet.columns = [{ width: 22 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 10 }]

  styleTitle(sheet, '광고 현황')
  writeMeta(sheet, {
    from: input.from,
    to: input.to,
    hours: input.hours,
    range: input.range,
    source: data.dataSource,
  })

  sheet.getCell('A7').value = '총 광고비'
  sheet.getCell('A7').font = { bold: true }
  wonCell(sheet, 'B7', data.totals.adSpend)

  const fromBreakdown = data.totals.adBreakdown ?? []
  const fromChannels = data.channels
    .filter((channel) => channel.kind === 'ads')
    .map((channel) => ({
      name: channel.name,
      platform: channel.platform ? AD_PLATFORM_LABEL[channel.platform] : '',
      product: channel.product ? AD_PRODUCT_LABEL[channel.product] : '',
      adSpend: channel.primaryValue,
      live: Boolean(channel.sourceLive),
    }))
  const rows = fromBreakdown.length
    ? fromBreakdown.map((item) => ({
        name: item.name,
        platform: AD_PLATFORM_LABEL[item.platform],
        product: AD_PRODUCT_LABEL[item.product],
        adSpend: item.adSpend,
        live: item.live,
      }))
    : fromChannels

  writeHeaderRow(sheet, 9, ['광고', '플랫폼', '구분', '광고비', '수집'])
  rows.forEach((row, index) => {
    const line = 10 + index
    sheet.getCell(`A${line}`).value = row.name
    sheet.getCell(`B${line}`).value = row.platform
    sheet.getCell(`C${line}`).value = row.product
    wonCell(sheet, `D${line}`, row.adSpend)
    sheet.getCell(`E${line}`).value = row.live ? '실측' : '대기'
  })

  return workbook
}

export function buildExcelReport(input: {
  id: ExcelReportId
  data: DashboardSnapshot
  range: DateRangeKey
  from: string
  to: string
  hours: number[] | null
}) {
  return input.id === 'sales' ? buildSalesWorkbook(input) : buildAdsWorkbook(input)
}

export async function downloadExcelReport(input: {
  id: ExcelReportId
  data: DashboardSnapshot
  range: DateRangeKey
  from: string
  to: string
  hours: number[] | null
}) {
  await downloadWorkbook(buildExcelReport(input), reportFilename(input.id, input.from, input.to))
}
