import { useEffect, useState, type CSSProperties } from 'react'
import { AnalyticsChart } from '../components/dashboard/AnalyticsChart'
import {
  ChannelCarousel,
  ChannelLaneFilter,
  filterChannelsByLane,
  type ChannelLane,
} from '../components/dashboard/ChannelCarousel'
import { ExcelTemplateFill } from '../components/dashboard/ExcelTemplateFill'
import { PeriodSummary } from '../components/dashboard/PeriodSummary'
import { SnapshotLookup } from '../components/dashboard/SnapshotLookup'
import { SnapshotPanel } from '../components/dashboard/SnapshotPanel'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { TrendChart } from '../components/dashboard/TrendChart'
import { Watchlist } from '../components/dashboard/Watchlist'
import { useDashboard, type DashboardMode } from '../hooks/useDashboard'
import { formatHoursLabel } from '../lib/format'
import { applySalesLane } from '../lib/laneDashboard'
import { kstYmd } from '../lib/kst'
import './DashboardPage.css'

function Skeleton() {
  return (
    <div className="dashboard-skel">
      <div className="dashboard-skel__row">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="dashboard-skel__card" />
        ))}
      </div>
      <div className="dashboard-skel__grid">
        <div className="dashboard-skel__block" />
        <div className="dashboard-skel__block" />
        <div className="dashboard-skel__block" />
      </div>
    </div>
  )
}

export function DashboardPage({
  mode = 'sales',
  onOpenMarketing,
}: {
  mode?: DashboardMode
  onOpenMarketing?: () => void
}) {
  const {
    data,
    status,
    errorMessage,
    refreshing,
    range,
    setRange,
    selectedFrom,
    selectedTo,
    selectedHours,
    applyLookup,
    selectedId,
    setSelectedId,
    selected,
  } = useDashboard('1M', mode)
  const [lane, setLane] = useState<ChannelLane>('all')
  const [enterDone, setEnterDone] = useState(false)

  useEffect(() => {
    if (status === 'loading' || !data || enterDone) return
    const timer = window.setTimeout(() => setEnterDone(true), 720)
    return () => window.clearTimeout(timer)
  }, [status, data, enterDone])

  if (status === 'error') {
    return (
      <div className="dashboard-error">
        {mode === 'ads' ? '광고 데이터를 불러오지 못했습니다.' : '대시보드 데이터를 불러오지 못했습니다.'}
        {errorMessage ? <span> ({errorMessage})</span> : null}
      </div>
    )
  }

  if (status === 'loading' || !data) {
    return <Skeleton />
  }

  const selectedSeries = selected ? (data.seriesByChannel[selected.id] ?? []) : []
  const isAds = mode === 'ads'
  const visibleChannels = isAds ? data.channels : filterChannelsByLane(data.channels, lane)

  const salesLane = isAds
    ? null
    : applySalesLane(data.channels, data.seriesByChannel, data.totals, data.periodTotals, lane)

  const displayTotals = isAds ? data.totals : (salesLane?.totals ?? data.totals)
  const displayPeriodTotals = isAds ? data.periodTotals : (salesLane?.periodTotals ?? data.periodTotals)
  const displaySummaryChannels = isAds ? data.channels : (salesLane?.channels ?? visibleChannels)
  const weeklyTopId = isAds ? data.periodTotals.weekly.topChannelId : (salesLane?.weeklyTopId ?? data.periodTotals.weekly.topChannelId)
  const weeklyTopValue = isAds
    ? data.periodTotals.weekly.topChannelValue
    : (salesLane?.weeklyTopValue ?? data.periodTotals.weekly.topChannelValue)
  const weeklyTopChannel = data.channels.find((channel) => channel.id === weeklyTopId)
  const excelFill = (
    <ExcelTemplateFill
      data={data}
      mode={mode}
      range={range}
      from={selectedFrom}
      to={selectedTo}
      hours={selectedHours}
    />
  )

  const allChannels = data.channels

  function handleLane(next: ChannelLane) {
    setLane(next)
    const nextChannels = filterChannelsByLane(allChannels, next)
    if (selectedId && !nextChannels.some((channel) => channel.id === selectedId)) {
      setSelectedId(nextChannels[0]?.id ?? null)
    }
  }
  const lookupProps = {
    from: selectedFrom,
    to: selectedTo,
    hours: selectedHours,
    availableHours: data.availableHours,
    minDate: kstYmd(new Date(), -365 * 3),
    maxDate: kstYmd(),
    onApply: applyLookup,
  }

  return (
    <div
      className={enterDone ? 'dashboard' : 'dashboard is-enter'}
      style={{ '--reveal-count': visibleChannels.length } as CSSProperties}
    >
      <ChannelCarousel
        key={isAds ? 'ads' : 'sales'}
        channels={visibleChannels}
        selectedId={selectedId}
        onSelect={setSelectedId}
        title={isAds ? '광고 모아보기' : '채널 모아보기'}
        sourceNote={
          isAds && data.dataSource === 'live' && data.latestSnapshotDate
            ? `${selectedFrom === selectedTo ? selectedTo : `${selectedFrom} ~ ${selectedTo}`}${
                selectedHours?.length ? ` ${formatHoursLabel(selectedHours)}` : ''
              }`
            : !isAds
              ? lane === 'online'
                ? '온라인 채널'
                : lane === 'offline'
                  ? '오프라인 채널'
                  : '온라인 · 오프라인 채널'
              : undefined
        }
        action={isAds ? excelFill : <ChannelLaneFilter value={lane} onChange={handleLane} />}
      />

      <div className="dashboard-mid">
        <div className="dashboard-mid__side">
          <SummaryCards
            totals={displayTotals}
            topChannel={weeklyTopChannel}
            topChannelValue={weeklyTopValue}
            mode={mode}
            onOpenMarketing={onOpenMarketing}
          />
        </div>
        <TrendChart
          range={range}
          onRangeChange={setRange}
          combined={data.combinedSeries}
          commerce={data.commerceSeries}
          sns={data.snsSeries}
          selected={selectedSeries}
          selectedName={selected?.name}
          refreshing={refreshing}
          variant={mode}
          highlightTime={data.highlightTime}
          lookup={<SnapshotLookup {...lookupProps} />}
        />
        <div className="dashboard-mid__period">
          <PeriodSummary
            periodTotals={displayPeriodTotals}
            channels={displaySummaryChannels}
            mode={mode}
            aside
          />
        </div>
        <SnapshotPanel
          channel={selected}
          emptyLabel={isAds ? '광고를 선택하세요' : '채널을 선택하세요'}
          wide
        />
      </div>

      <div className="dashboard-bottom">
        <AnalyticsChart
          series={data.combinedSeries}
          range={range}
          refreshing={refreshing}
          title={isAds ? '광고 성과' : '통합 성과'}
          highlightTime={data.highlightTime}
          action={isAds ? undefined : excelFill}
          lookup={<SnapshotLookup {...lookupProps} />}
        />
        <Watchlist
          channels={visibleChannels}
          selectedId={selectedId}
          onSelect={setSelectedId}
          title={isAds ? '광고 워치리스트' : '채널 워치리스트'}
        />
      </div>
    </div>
  )
}
