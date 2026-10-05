/**
 * "출석하기" 를 이글루 웹에 넘기는 자리.
 *
 * 이 파일이 존재하는 이유는 API 키다. 클라이언트가 이글루 웹을 직접 부르면
 * 키를 정적 번들에 넣어야 하는데, 그러면 키가 아니다 - 누구든 개발자 도구로
 * 꺼내 쓴다. 게다가 그 경로로는 "방에 있었다"를 증명하지 못한다. 집에서
 * 주소만 쳐도 출석이 찍히면 PRD 4.8 의 "방에 나타났는지"가 무의미해진다.
 *
 * 여기로 오려면 Colyseus 방에 연결되어 있어야 하고, 그러려면 onAuth 를
 * 통과했어야 한다. 그 사실이 곧 "방에 있다"는 증거고, 키는 서버에만 남는다.
 *
 * 신원은 키가 아니라 사용자 토큰이 증명한다. 키가 신원까지 대신하면 키를
 * 가진 쪽이 아무나 출석시킬 수 있게 된다.
 */

export interface CheckInResult {
  ok: boolean
  message: string
  /** 이미 찍혀 있던 경우. 실패가 아니라서 따로 구분한다. */
  already?: boolean
}

/** 이글루 웹이 느릴 때 방 안에서 버튼이 영영 안 돌아오는 것을 막는다. */
const TIMEOUT_MS = 10_000

/**
 * The `sub` claim, without verifying anything.
 *
 * Only ever used to *refuse*. Whether the token is genuine is Supabase's
 * answer, not ours, and it is still asked below - so a forged token with the
 * right `sub` gets past this line and dies at the next one. Reading it here
 * costs nothing and closes the case where somebody in the room checks in a
 * member who is not.
 */
function subjectOf(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    return JSON.parse(json).sub ?? null
  } catch {
    return null
  }
}

/**
 * What the igloo web service says about today's meeting for one member - the
 * room asks so the browser can check in on its own (see client autoCheckIn).
 * Only the fields the room passes on are listed.
 */
export interface AttendanceStatus {
  ok: boolean
  message?: string
  /** has an online time today */
  eligible?: boolean
  /** not checked in yet and the window is open */
  prompt?: boolean
  /** not_open | on_time | late | present | absent | unavailable ... */
  state?: string
  /** check-in opens - ten minutes before the meeting starts */
  opensAt?: string
  lateAt?: string
}

type Refusal = { ok: false; message: string }

/**
 * One call to the igloo web service on behalf of the member in the room. The
 * checks before the fetch are the same for every endpoint, so they live here.
 */
async function callIglooWeb(
  path: string,
  token: string | null | undefined,
  expectedUserId: string
): Promise<Refusal | { ok: true; body: any }> {
  const url = process.env.IGLOO_WEB_URL
  const key = process.env.IGLOO_API_KEY

  if (!url || !key) {
    console.error('IGLOO_WEB_URL / IGLOO_API_KEY are not set - cannot check anyone in')
    return { ok: false, message: '출석 기능이 아직 준비되지 않았습니다' }
  }

  if (!token) {
    return { ok: false, message: '로그인 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요' }
  }

  /**
   * The token has to belong to the person sitting in the room.
   *
   * Without this the room proves only that *somebody* is connected: anyone
   * inside could pass a token belonging to a member who stayed home and have
   * them marked present. Attendance is meant to say who turned up, so the two
   * have to be the same person.
   */
  if (subjectOf(token) !== expectedUserId) {
    console.error(`check-in token does not belong to the connected member (${expectedUserId})`)
    return { ok: false, message: '로그인 정보가 방에 들어온 계정과 다릅니다. 새로고침 후 다시 시도해 주세요' }
  }

  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'x-igloo-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: abort.signal,
    })
    return { ok: true, body: await response.json() }
  } catch (error) {
    console.error(`${path} request failed:`, error)
    return { ok: false, message: '이글루 웹에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요' }
  } finally {
    clearTimeout(timer)
  }
}

export async function requestCheckIn(
  token: string | null | undefined,
  /** who the room says is asking, settled back in onAuth */
  expectedUserId: string
): Promise<CheckInResult> {
  const result = await callIglooWeb('/api/attendance/check-in', token, expectedUserId)
  if (!('body' in result)) return result

  const body = result.body as CheckInResult
  // 실패 사유는 이글루 웹이 정한다. 여기서 다시 지어내면 두 곳에서 갈린다.
  return { ok: Boolean(body?.ok), message: body?.message ?? '출석하지 못했습니다', already: body?.already }
}

export async function requestAttendanceStatus(
  token: string | null | undefined,
  expectedUserId: string
): Promise<AttendanceStatus> {
  const result = await callIglooWeb('/api/attendance/status', token, expectedUserId)
  if (!('body' in result)) return result

  const body = result.body ?? {}
  if (!body.ok) return { ok: false, message: body.message ?? '출석 정보를 확인하지 못했습니다' }
  return {
    ok: true,
    eligible: Boolean(body.eligible),
    prompt: Boolean(body.prompt),
    state: body.state,
    opensAt: body.opensAt,
    lateAt: body.lateAt,
  }
}
