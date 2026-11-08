import { describe, expect, it } from 'vitest'
import { checkInMessage, meetingTimeLabel } from './checkInMessage'

const at = (iso: string) => Date.parse(iso)
const ten = at('2026-10-05T10:00:00+09:00')
const fresh = { ok: true, message: '출석으로 기록되었습니다.', already: false, status: 'present' }

describe('meetingTimeLabel', () => {
  it('reads the hour on Seoul time', () => {
    expect(meetingTimeLabel(ten)).toBe('10시')
    expect(meetingTimeLabel(at('2026-10-05T20:30:00+09:00'))).toBe('20시 30분')
  })
})

describe('checkInMessage', () => {
  it('says the meeting time when the automatic check-in records it: 10시에 출석되었습니다', () => {
    expect(checkInMessage(fresh, ten)).toEqual({ ok: true, message: '10시에 출석되었습니다' })
  })

  it('keeps quiet when the automatic check-in finds it already recorded', () => {
    expect(checkInMessage({ ...fresh, already: true }, ten)).toBeNull()
  })

  it('tells the button it was already recorded instead of repeating the first alert', () => {
    expect(checkInMessage({ ...fresh, already: true })).toEqual({
      ok: true,
      message: '이미 출석이 기록되어 있습니다',
    })
  })

  it("leaves the button's fresh check-in in the igloo web service's words", () => {
    expect(checkInMessage(fresh)).toEqual({ ok: true, message: '출석으로 기록되었습니다.' })
  })

  it('still says late in its own words, even when automatic', () => {
    const late = { ok: true, message: '늦은 참석으로 기록되었습니다.', already: false, status: 'late' }
    expect(checkInMessage(late, ten)).toEqual({ ok: true, message: '늦은 참석으로 기록되었습니다.' })
  })

  it('passes a refusal through', () => {
    const refused = { ok: false, message: '참여 기록은 모임 10분 전부터 할 수 있습니다' }
    expect(checkInMessage(refused, ten)).toEqual(refused)
  })
})
