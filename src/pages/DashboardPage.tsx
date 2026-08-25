import type { CSSProperties } from 'react'
import { AnalyticsChart } from '../components/dashboard/AnalyticsChart'
import { ChannelCarousel } from '../components/dashboard/ChannelCarousel'
import { PeriodSummary } from '../components/dashboard/PeriodSummary'
import { SnapshotLookup } from '../components/dashboard/SnapshotLookup'
import { SnapshotPanel } from '../components/dashboard/SnapshotPanel'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { TrendChart } from '../components/dashboard/TrendChart'
import { Watchlist } from '../components/dashboard/Watchlist'
import { useDashboard, type DashboardMode } from '../hooks/useDashboard'
import { formatHoursLabel } from '../lib/format'
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

  const topChannel = data.channels.find((channel) => channel.id === data.totals.topChannelId)
  const selectedSeries = selected ? (data.seriesByChannel[selected.id] ?? []) : []
  const isAds = mode === 'ads'
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
      className="dashboard is-enter"
      style={{ '--reveal-count': data.channels.length } as CSSProperties}
    >
      <ChannelCarousel
        channels={data.channels}
        selectedId={selectedId}
        onSelect={setSelectedId}
        title={isAds ? '내 광고' : '내 채널'}
        sourceNote={
          isAds
            ? data.dataSource === 'live' && data.latestSnapshotDate
              ? `광고 SA/DA · ${selectedFrom === selectedTo ? selectedTo : `${selectedFrom} ~ ${selectedTo}`}${
                selectedHours?.length ? ` ${formatHoursLabel(selectedHours)}` : ''
              }`
              : '광고 수집 대기'
            : undefined
        }
      />

      <div className="dashboard-mid">
        <div className="dashboard-mid__side">
          <SummaryCards
            totals={data.totals}
            topChannel={topChannel}
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
          <PeriodSummary periodTotals={data.periodTotals} channels={data.channels} mode={mode} aside />
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
          lookup={<SnapshotLookup {...lookupProps} />}
        />
        <Watchlist
          channels={data.channels}
          selectedId={selectedId}
          onSelect={setSelectedId}
          title={isAds ? '광고 워치리스트' : '채널 워치리스트'}
        />
      </div>
    </div>
  )
}
