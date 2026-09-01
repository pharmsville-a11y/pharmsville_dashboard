export const APP_TOAST_EVENT = 'channelboard:app-toast'
export const APP_TOAST_DURATION_MS = 5_000

export function showAppToast(message: string) {
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, { detail: { message } }))
}
