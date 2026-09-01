import { Download } from 'lucide-react'
import { useState } from 'react'
import type { DateRangeKey } from '../../adapters/types'
import type { DashboardMode } from '../../hooks/useDashboard'
import { downloadExcelReport, EXCEL_REPORTS, type ExcelReportId } from '../../lib/excelReports'
import type { DashboardSnapshot } from '../../services/types'
import './ExcelTemplateFill.css'

export function ExcelTemplateFill({
  data,
  mode,
  range,
  from,
  to,
  hours,
}: {
  data: DashboardSnapshot
  mode: DashboardMode
  range: DateRangeKey
  from: string
  to: string
  hours: number[] | null
}) {
  const [busy, setBusy] = useState<ExcelReportId | null>(null)
  const [note, setNote] = useState('')

  async function handleDownload(id: ExcelReportId) {
    setBusy(id)
    setNote('')
    try {
      await downloadExcelReport({ id, data, range, from, to, hours })
    } catch (error) {
      setNote(error instanceof Error ? error.message : '엑셀을 만들지 못했습니다.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="excel-fill">
      {EXCEL_REPORTS.map((report) => (
        <button
          key={report.id}
          type="button"
          className={report.id === (mode === 'ads' ? 'ads' : 'sales') ? 'excel-fill__btn is-primary' : 'excel-fill__btn'}
          disabled={busy != null}
          onClick={() => void handleDownload(report.id)}
        >
          <Download size={15} />
          {busy === report.id ? '받는 중…' : report.label}
        </button>
      ))}
      {note ? <p className="excel-fill__note">{note}</p> : null}
    </div>
  )
}
