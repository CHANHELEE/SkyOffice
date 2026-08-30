/**
 * Deciding who is allowed into the igloo room.
 *
 * Entry used to be one shared password. It is now "are you an igloo member, and
 * are you logged in" - a question the igloo web service already knows the answer
 * to. The browser hands us the Supabase access token it is already holding, and
 * we ask Supabase about it. Nothing the client claims about *who* it is gets
 * trusted; only the token, and only what Supabase says about the token.
 *
 * Two questions, and both are needed:
 *
 *   1. Is the token real and unexpired?      GET  /auth/v1/user
 *   2. Is this person on the roster and
 *      taking part right now?                POST /rest/v1/rpc/my_status
 *
 * The second one is easy to forget and fatal to skip. Anyone at all can sign up
 * with Kakao and come away with a perfectly valid token - that says nothing
 * about whether they are in the study group. Sorting that out is exactly what
 * /onboarding and /waiting on the web side are for.
 *
 * Every call below goes out with the member's own token, so Postgres sees
 * `auth.uid()` and RLS applies exactly as it does on the web. This server
 * therefore never needs - and must never be given - the service role key.
 *
 * There is no supabase client library here on purpose. These are two plain REST
 * calls, and the current library requires Node 22; pinning the game server's
 * runtime for the sake of two fetches is a bad trade.
 */

import { AuthFailure } from '../types/Auth'

export class IglooAuthError extends Error {
  constructor(readonly code: number, message: string) {
    super(message)
  }
}

/** the parts of an igloo member this server actually uses */
export interface IglooMember {
  userId: string
  memberId: string | null
  displayName: string
  isAdmin: boolean
}

type StatusRow = {
  member_id: string | null
  display_name: string | null
  status: string | null
  cohort_id: string | null
  is_admin: boolean | null
}

function config() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new IglooAuthError(AuthFailure.LOOKUP_FAILED, 'server is missing its supabase config')
  }
  return { url: url.replace(/\/$/, ''), key }
}

async function callSupabase(path: string, token: string, init?: RequestInit) {
  const { url, key } = config()

  let response: Response
  try {
    response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string>),
      },
    })
  } catch (error) {
    console.error('supabase unreachable:', error)
    throw new IglooAuthError(
      AuthFailure.LOOKUP_FAILED,
      '이글루 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    )
  }

  // 401 here always means the token, whatever the endpoint
  if (response.status === 401 || response.status === 403) {
    throw new IglooAuthError(AuthFailure.NOT_SIGNED_IN, '로그인이 만료되었습니다. 다시 로그인해 주세요.')
  }
  if (!response.ok) {
    console.error(`supabase ${path} returned ${response.status}: ${await response.text()}`)
    throw new IglooAuthError(
      AuthFailure.LOOKUP_FAILED,
      '이글루 명단을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    )
  }

  return response.json()
}

/**
 * Which cohort's membership counts as "now".
 *
 * my_status() picks one on its own, but the web service does not take that
 * answer at face value (lib/auth.ts): past participation can be entered long
 * after the fact, so joined_at ordering can mistake an old cohort for the
 * current one. It re-picks by the cohort that actually started most recently.
 *
 * We repeat that here rather than simplify it. If the two services disagree
 * about who is taking part, the member sees the web let them in and the room
 * turn them away, and there is nothing on screen to explain why.
 */
async function currentStatus(token: string, memberId: string, fallback: string | null) {
  const memberships = (await callSupabase(
    `/rest/v1/cohort_members?member_id=eq.${memberId}&select=cohort_id,status`,
    token
  )) as { cohort_id: string; status: string }[]

  if (!memberships?.length) return fallback

  const ids = memberships.map((membership) => membership.cohort_id).join(',')
  const latest = (await callSupabase(
    `/rest/v1/cohorts?id=in.(${ids})&select=id&order=start_date.desc&limit=1`,
    token
  )) as { id: string }[]

  const current = memberships.find((membership) => membership.cohort_id === latest?.[0]?.id)
  return current ? current.status : fallback
}

/**
 * Throws IglooAuthError unless the token belongs to a member who is taking part.
 * The returned name is the roster's, and it is the only name this member gets
 * to wear in the room.
 */
export async function authenticateMember(token: string | null | undefined): Promise<IglooMember> {
  if (!token) {
    throw new IglooAuthError(AuthFailure.NOT_SIGNED_IN, '이글루 계정으로 로그인해 주세요.')
  }

  // proves the token is real, unexpired and not revoked. doing this before the
  // roster lookup means an expired session is reported as "log in again" rather
  // than as a roster problem, which is what the member can actually act on.
  const user = (await callSupabase('/auth/v1/user', token)) as { id?: string }
  if (!user?.id) {
    throw new IglooAuthError(AuthFailure.NOT_SIGNED_IN, '로그인 정보를 확인하지 못했습니다.')
  }

  const rows = (await callSupabase('/rest/v1/rpc/my_status', token, {
    method: 'POST',
    body: '{}',
  })) as StatusRow[]
  const row = rows?.[0]

  const isAdmin = row?.is_admin === true
  const memberId = row?.member_id ?? null

  // the first admin has no roster row of their own - that is the chicken-and-egg
  // the web service documents, and it must not lock them out of the room
  if (isAdmin) {
    return {
      userId: user.id,
      memberId,
      displayName: row?.display_name || '운영진',
      isAdmin: true,
    }
  }

  if (!memberId) {
    throw new IglooAuthError(
      AuthFailure.NOT_ON_ROSTER,
      '이글루 명단과 아직 연결되지 않았습니다. 이글루에서 초대 코드를 입력해 주세요.'
    )
  }

  const status = await currentStatus(token, memberId, row?.status ?? null)
  if (status !== 'active') {
    throw new IglooAuthError(
      AuthFailure.NOT_TAKING_PART,
      status === 'paused'
        ? '이번 기수는 쉬어가는 중이라 입장할 수 없습니다.'
        : '운영진 승인 후에 입장할 수 있습니다.'
    )
  }

  return {
    userId: user.id,
    memberId,
    displayName: row?.display_name || '이름 없음',
    isAdmin: false,
  }
}
