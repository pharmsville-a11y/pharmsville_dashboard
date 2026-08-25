export const HOURLY_REFRESH_EVENT = 'channelboard:hourly-refresh'
export const HOURLY_UPDATE_PREVIEW_EVENT = 'channelboard:hourly-update'

export function requestHourlyRefresh() {
  window.dispatchEvent(new Event(HOURLY_REFRESH_EVENT))
}
