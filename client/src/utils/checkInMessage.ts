/**
 * What the alert says after "출석하기", automatic or pressed.
 *
 * Kept apart from the store and the network so it can be tested on its own.
 */
import type { CheckInResult } from '../stores/AttendanceStore'

/** what the room hands back from the igloo web service (server/iglooCheckIn.ts) */
export interface RoomCheckInResult {
  ok: boolean
  message: string
  /** it was already recorded before this request */
  already?: boolean
  /** present | late */
  status?: string
}

/** 10:00 -> "10시", 10:30 -> "10시 30분", always on Seoul time like the meetings */
export function meetingTimeLabel(startsAt: number): string {
  const seoul = new Date(startsAt + 9 * 60 * 60 * 1000)
  const hours = seoul.getUTCHours()
  const minutes = seoul.getUTCMinutes()
  return minutes ? `${hours}시 ${minutes}분` : `${hours}시`
}

/**
 * @param startsAt the meeting's start when the automatic check-in pressed it;
 *                 left out for the button
 * @returns null when there is nothing worth showing
 */
export function checkInMessage(result: RoomCheckInResult, startsAt?: number): CheckInResult | null {
  const auto = startsAt !== undefined

  if (result.ok && result.already) {
    /* Recorded earlier - by this same timer in another tab or on another
       device, or by the button. The igloo web service answers with the very
       same wording as a fresh check-in, so showing it again reads as a second
       check-in. The timer keeps quiet; the button says it was already done. */
    if (auto) return null
    return { ok: true, message: '이미 출석이 기록되어 있습니다' }
  }

  // late is still worth saying in the igloo web service's own words
  if (auto && result.ok && result.status === 'present') {
    return { ok: true, message: `${meetingTimeLabel(startsAt)}에 출석되었습니다` }
  }

  return { ok: result.ok, message: result.message }
}
