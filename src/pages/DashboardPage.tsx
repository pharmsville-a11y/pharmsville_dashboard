import { AnalyticsChart } from '../components/dashboard/AnalyticsChart'
import { ChannelCarousel } from '../components/dashboard/ChannelCarousel'
import { PeriodSummary } from '../components/dashboard/PeriodSummary'
import { SnapshotPanel } from '../components/dashboard/SnapshotPanel'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { TrendChart } from '../components/dashboard/TrendChart'
import { Watchlist } from '../components/dashboard/Watchlist'
import { useDashboard } from '../hooks/useDashboard'
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

export function DashboardPage() {
  const { data, status, refreshing, range, setRange, selectedId, setSelectedId, selected } = useDashboard()

  if (status === 'error') {
    return (
      <div className="dashboard-error">
        대시보드 데이터를 불러오지 못했습니다. mock 어댑터를 확인하세요.
      </div>
    )
  }

  if (status === 'loading' || !data) {
    return <Skeleton />
  }

  const topChannel = data.channels.find((channel) => channel.id === data.totals.topChannelId)
  const selectedSeries = selected ? (data.seriesByChannel[selected.id] ?? []) : []

  return (
    <div className="dashboard">
      <ChannelCarousel
        channels={data.channels}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <div className="dashboard-mid">
        <div className="dashboard-mid__side">
          <SummaryCards totals={data.totals} topChannel={topChannel} />
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
        />
        <SnapshotPanel channel={selected} />
        <div className="dashboard-mid__period">
          <PeriodSummary periodTotals={data.periodTotals} channels={data.channels} />
        </div>
      </div>

      <div className="dashboard-bottom">
        <AnalyticsChart series={data.combinedSeries} range={range} refreshing={refreshing} />
        <Watchlist
          channels={data.channels}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  )
}
