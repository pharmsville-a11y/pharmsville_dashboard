import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { FreeMode } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperClass } from 'swiper'
import 'swiper/css'
import 'swiper/css/free-mode'
import type { ChannelSummary } from '../../adapters/types'
import { formatNumber, formatPct, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { ChannelBadge } from '../ui/ChannelBadge'
import { Sparkline } from '../ui/Sparkline'
import './ChannelCarousel.css'

function primaryText(channel: ChannelSummary): string {
  if (channel.kind === 'sns') return formatNumber(channel.primaryValue)
  return formatWon(channel.primaryValue)
}

function syncArrows(
  instance: SwiperClass,
  setCanPrev: (value: boolean | ((current: boolean) => boolean)) => void,
  setCanNext: (value: boolean | ((current: boolean) => boolean)) => void,
) {
  const prev = !instance.isBeginning
  const next = !instance.isEnd
  setCanPrev((current) => (current === prev ? current : prev))
  setCanNext((current) => (current === next ? current : next))
}

export function ChannelCarousel({
  channels,
  selectedId,
  onSelect,
  title = '내 채널',
  sourceNote,
}: {
  channels: ChannelSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  title?: string
  sourceNote?: string
}) {
  const [swiper, setSwiper] = useState<SwiperClass | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  function handleSwiper(instance: SwiperClass) {
    setSwiper(instance)
    syncArrows(instance, setCanPrev, setCanNext)
  }

  function handleNav(direction: -1 | 1) {
    if (!swiper) return
    const next = Math.min(0, Math.max(swiper.maxTranslate(), swiper.translate - direction * swiper.width * 0.7))
    swiper.setTransition(400)
    swiper.setTranslate(next)
    swiper.updateProgress()
    swiper.updateActiveIndex()
    syncArrows(swiper, setCanPrev, setCanNext)
  }

  return (
    <section className="carousel">
      <div className="carousel__head">
        <h2>{title}</h2>
        {sourceNote ? <p className="carousel__source">{sourceNote}</p> : null}
      </div>
      <div className="carousel__wrap">
        <Swiper
          className="carousel__scroller"
          modules={[FreeMode]}
          slidesPerView="auto"
          spaceBetween={14}
          grabCursor
          watchOverflow
          resistanceRatio={0.65}
          freeMode={{
            enabled: true,
            sticky: false,
            momentum: true,
            momentumRatio: 0.85,
            momentumBounce: false,
          }}
          onSwiper={handleSwiper}
          onProgress={(instance) => syncArrows(instance, setCanPrev, setCanNext)}
          onResize={(instance) => syncArrows(instance, setCanPrev, setCanNext)}
          onFromEdge={(instance) => syncArrows(instance, setCanPrev, setCanNext)}
          onToEdge={(instance) => syncArrows(instance, setCanPrev, setCanNext)}
        >
          {channels.map((channel, index) => {
            const up = channel.changePct >= 0
            return (
              <SwiperSlide key={channel.id}>
                <button
                  type="button"
                  onClick={() => onSelect(channel.id)}
                  className={cx('carousel__card', channel.id === selectedId && 'is-selected')}
                  style={{ background: channel.accent, '--reveal-i': index } as CSSProperties}
                >
                  <div className="carousel__top">
                    <div className="carousel__meta">
                      <ChannelBadge channel={channel} />
                      <div>
                        <p className="carousel__name">{channel.name}</p>
                        <p className="carousel__ticker">
                          {channel.ticker}
                          {channel.sourceLive ? <span className="carousel__live">LIVE</span> : null}
                        </p>
                      </div>
                    </div>
                    <span className={cx('carousel__change', up ? 'is-up' : 'is-down')}>
                      {formatPct(channel.changePct)}
                    </span>
                  </div>
                  <p className="carousel__value">{primaryText(channel)}</p>
                  {channel.kind === 'ads' ? <p className="carousel__ad">{channel.primaryLabel}</p> : null}
                  <Sparkline data={channel.sparkline} color={channel.sparkColor} />
                </button>
              </SwiperSlide>
            )
          })}
        </Swiper>
        <button
          type="button"
          aria-label="이전"
          disabled={!canPrev}
          onClick={() => handleNav(-1)}
          className={cx('carousel__arrow', 'carousel__arrow--prev', !canPrev && 'is-hidden')}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          aria-label="다음"
          disabled={!canNext}
          onClick={() => handleNav(1)}
          className={cx('carousel__arrow', 'carousel__arrow--next', !canNext && 'is-hidden')}
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  )
}
