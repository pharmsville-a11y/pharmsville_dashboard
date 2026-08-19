import { ChevronLeft, ChevronRight } from 'lucide-react'
import { memo, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import Slider from 'react-slick'
import type { Settings } from 'react-slick'
import 'slick-carousel/slick/slick.css'
import type { ChannelSummary } from '../../adapters/types'
import { formatNumber, formatPct, formatWon } from '../../lib/format'
import { cx } from '../../lib/cx'
import { ChannelBadge } from '../ui/ChannelBadge'
import { Sparkline } from '../ui/Sparkline'
import './ChannelCarousel.css'

const CARD_STEP = 230

function primaryText(channel: ChannelSummary): string {
  if (channel.kind === 'commerce') return formatWon(channel.primaryValue)
  return formatNumber(channel.primaryValue)
}

const ChannelSlider = memo(function ChannelSlider({
  channels,
  selectedId,
  onSelect,
  settings,
  sliderRef,
}: {
  channels: ChannelSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  settings: Settings
  sliderRef: RefObject<Slider | null>
}) {
  return (
    <Slider ref={sliderRef} {...settings} className="carousel__scroller">
      {channels.map((channel) => {
        const up = channel.changePct >= 0
        return (
          <div key={channel.id} className="carousel__slide">
            <button
              type="button"
              onClick={() => onSelect(channel.id)}
              className={cx('carousel__card', channel.id === selectedId && 'is-selected')}
              style={{ background: channel.accent }}
            >
              <div className="carousel__top">
                <div className="carousel__meta">
                  <ChannelBadge channel={channel} />
                  <div>
                    <p className="carousel__name">{channel.name}</p>
                    <p className="carousel__ticker">{channel.ticker}</p>
                  </div>
                </div>
                <span className={cx('carousel__change', up ? 'is-up' : 'is-down')}>
                  {formatPct(channel.changePct)}
                </span>
              </div>
              <p className="carousel__value">{primaryText(channel)}</p>
              <Sparkline data={channel.sparkline} color={channel.sparkColor} />
            </button>
          </div>
        )
      })}
    </Slider>
  )
})

export function ChannelCarousel({
  channels,
  selectedId,
  onSelect,
}: {
  channels: ChannelSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<Slider>(null)
  const [slidesToShow, setSlidesToShow] = useState(1)
  const [current, setCurrent] = useState(0)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return

    function update() {
      const width = wrapRef.current?.clientWidth
      if (!width) return
      const next = Math.max(1, Math.floor(width / CARD_STEP))
      setSlidesToShow((prev) => (prev === next ? prev : next))
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [channels.length])

  const visible = Math.min(slidesToShow, Math.max(channels.length, 1))
  const canPrev = current > 0
  const canNext = current < channels.length - visible

  const settings: Settings = useMemo(
    () => ({
      dots: false,
      infinite: false,
      speed: 450,
      cssEase: 'cubic-bezier(0.22, 1, 0.36, 1)',
      slidesToShow: visible,
      slidesToScroll: 1,
      arrows: false,
      swipeToSlide: true,
      waitForAnimate: true,
      afterChange: setCurrent,
    }),
    [visible],
  )

  return (
    <section className="carousel">
      <div className="carousel__head">
        <h2>내 채널</h2>
      </div>
      <div ref={wrapRef} className="carousel__wrap">
        <ChannelSlider
          channels={channels}
          selectedId={selectedId}
          onSelect={onSelect}
          settings={settings}
          sliderRef={sliderRef}
        />
        <button
          type="button"
          aria-label="이전 채널"
          disabled={!canPrev}
          onClick={() => sliderRef.current?.slickPrev()}
          className={cx('carousel__arrow', 'carousel__arrow--prev', !canPrev && 'is-hidden')}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          aria-label="다음 채널"
          disabled={!canNext}
          onClick={() => sliderRef.current?.slickNext()}
          className={cx('carousel__arrow', 'carousel__arrow--next', !canNext && 'is-hidden')}
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  )
}
