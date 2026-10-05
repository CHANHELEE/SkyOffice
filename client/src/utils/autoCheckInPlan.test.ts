import { describe, expect, it } from 'vitest'
import { AUTO_CHECK_IN_LEAD_MS, planAutoCheckIn } from './autoCheckInPlan'

const MIN = 60 * 1000
// a 10:00 KST meeting
const startsAt = Date.parse('2026-10-05T10:00:00+09:00')
const opensAt = new Date(startsAt - 10 * MIN).toISOString()
const lateAt = new Date(startsAt + 61 * 1000).toISOString()
const now = Date.parse('2026-10-05T09:30:00+09:00')

describe('planAutoCheckIn', () => {
  it('checks in nine minutes before the start: 09:51 for a 10:00 meeting', () => {
    const plan = planAutoCheckIn(
      { ok: true, eligible: true, prompt: false, state: 'not_open', opensAt, lateAt, serverNow: now },
      now
    )
    expect(plan).toEqual({ startsAt, at: Date.parse('2026-10-05T09:51:00+09:00') })
    expect(startsAt - plan!.at).toBe(AUTO_CHECK_IN_LEAD_MS)
  })

  it('still plans once the window is open but nobody has checked in', () => {
    const plan = planAutoCheckIn(
      { ok: true, eligible: true, prompt: true, state: 'on_time', opensAt, lateAt },
      now
    )
    expect(plan?.startsAt).toBe(startsAt)
  })

  it('still plans after the late line, while it is not recorded yet', () => {
    const plan = planAutoCheckIn(
      { ok: true, eligible: true, prompt: true, state: 'late', opensAt, lateAt },
      now
    )
    expect(plan?.startsAt).toBe(startsAt)
  })

  it('does nothing once present or late is already recorded', () => {
    for (const state of ['present', 'late']) {
      expect(
        planAutoCheckIn({ ok: true, eligible: true, prompt: false, state, opensAt, lateAt }, now)
      ).toBeNull()
    }
  })

  it('does nothing when an admin has decided', () => {
    expect(
      planAutoCheckIn(
        { ok: true, eligible: true, prompt: false, state: 'absent', opensAt, lateAt },
        now
      )
    ).toBeNull()
  })

  it('does nothing without an online time today', () => {
    expect(
      planAutoCheckIn({ ok: true, eligible: false, prompt: false, state: 'unavailable' }, now)
    ).toBeNull()
  })

  it('does nothing when the room could not ask', () => {
    expect(planAutoCheckIn({ ok: false, message: '출석 기능이 아직 준비되지 않았습니다' }, now)).toBeNull()
  })

  it('does nothing with a time it cannot read', () => {
    expect(
      planAutoCheckIn(
        { ok: true, eligible: true, prompt: false, state: 'not_open', opensAt: 'soon' },
        now
      )
    ).toBeNull()
  })

  it('moves onto the browser clock when it runs three minutes slow', () => {
    // the room says 09:30, this browser says 09:27
    const plan = planAutoCheckIn(
      { ok: true, eligible: true, prompt: false, state: 'not_open', opensAt, serverNow: now },
      now - 3 * MIN
    )
    // 09:51 on the room's clock is 09:48 on this one
    expect(plan!.at).toBe(Date.parse('2026-10-05T09:48:00+09:00'))
  })

  it('moves onto the browser clock when it runs fast', () => {
    const plan = planAutoCheckIn(
      { ok: true, eligible: true, prompt: false, state: 'not_open', opensAt, serverNow: now },
      now + 2 * MIN
    )
    expect(plan!.at).toBe(Date.parse('2026-10-05T09:53:00+09:00'))
  })
})
