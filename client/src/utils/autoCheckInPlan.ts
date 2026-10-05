/**
 * When to press "출석하기" on a member's behalf.
 *
 * Kept free of the store and the network so it can be tested on its own - the
 * part that runs the timer is services/AutoCheckIn.ts.
 */

/** check in this long before the meeting starts */
export const AUTO_CHECK_IN_LEAD_MS = 9 * 60 * 1000

/**
 * The igloo web service opens check-in ten minutes before the start
 * (member_attendance_prompt: opens_at = starts_at - 10 minutes). It hands back
 * the opening rather than the start, so the start is worked out from it.
 */
const OPENS_BEFORE_START_MS = 10 * 60 * 1000

/** what the room relays from /api/attendance/status, plus the room's clock */
export interface AttendanceStatus {
  ok: boolean
  message?: string
  eligible?: boolean
  prompt?: boolean
  state?: string
  opensAt?: string
  lateAt?: string
  /** Date.now() on the game server when it answered */
  serverNow?: number
}

export interface AutoCheckInPlan {
  /** the meeting's start - also what identifies it, so it is tried only once */
  startsAt: number
  /** when to check in, on this browser's clock */
  at: number
}

/**
 * @param status    the room's answer
 * @param receivedAt Date.now() in this browser when the answer arrived
 * @returns null when there is nothing to do: no online time today, already
 *          checked in, or settled by an admin
 */
export function planAutoCheckIn(
  status: AttendanceStatus,
  receivedAt: number
): AutoCheckInPlan | null {
  if (!status.ok || !status.eligible || !status.opensAt) return null

  /* 'not_open' is the only state where prompt is false and checking in is
     still to come. Everything else with prompt false - present, late already
     recorded, an admin's decision - is finished. */
  if (status.state !== 'not_open' && !status.prompt) return null

  const opensAt = Date.parse(status.opensAt)
  if (Number.isNaN(opensAt)) return null

  const startsAt = opensAt + OPENS_BEFORE_START_MS

  /* The times above are the server's. A browser clock a few minutes out would
     press too early - before the window opens, and get refused - or too late.
     Shift onto this browser's clock by how far it is from the room's. */
  const skew = status.serverNow ? status.serverNow - receivedAt : 0

  return { startsAt, at: startsAt - AUTO_CHECK_IN_LEAD_MS - skew }
}
