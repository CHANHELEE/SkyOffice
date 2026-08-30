import { createBrowserClient } from '@supabase/ssr'

/**
 * The same login session the igloo web service uses.
 *
 * This is deliberately `@supabase/ssr` and not plain `supabase-js`. The default
 * client keeps the session in localStorage, and localStorage is walled off per
 * origin - www.myigloos.com and www.metabus.myigloos.com would never see each
 * other's. `@supabase/ssr` keeps it in a cookie instead, under the same name and
 * the same chunking as the web service, scoped to the parent domain. That one
 * difference is what makes logging in on either side count on both.
 *
 * Keep the major version in step with the web service's. The two are reading
 * and writing the same cookie, so the format has to agree.
 *
 * The publishable (anon) key belongs in the browser - it is meant to be public,
 * and RLS in Postgres is what actually decides who may read what.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

/** where to send somebody who has to finish something on the web side */
export const IGLOO_WEB_URL = (
  (import.meta.env.VITE_IGLOO_WEB_URL as string) || 'https://www.myigloos.com'
).replace(/\/$/, '')

if (!supabaseUrl || !supabaseKey) {
  // louder than a blank screen, and says which of the two is missing
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set for the client to sign anyone in'
  )
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  cookieOptions: {
    /**
     * `.myigloos.com` in production, so the cookie is shared with the web
     * service. Left unset locally - a domain attribute on `localhost` makes the
     * browser throw the cookie away. Unset still works locally, because cookies
     * ignore ports: what localhost:3000 sets, localhost:5173 reads.
     */
    domain: (import.meta.env.VITE_COOKIE_DOMAIN as string) || undefined,

    /**
     * HTTPS only. This has to match the web service exactly - whichever side
     * writes the cookie last decides its attributes, so setting it on one side
     * alone would let the other quietly hand back a cookie without `Secure`.
     *
     * It matters because the cookie now follows every subdomain of
     * myigloos.com, and this one has no HSTS: reach it over http even once and
     * the session goes out in the clear. The redirect to https arrives after
     * the request that carried the cookie.
     *
     * Off locally, where everything is http and turning it on would make the
     * browser discard the cookie and break login outright.
     */
    secure: Boolean(import.meta.env.VITE_COOKIE_DOMAIN),
  },
})

/**
 * The token to show at the door, or null if nobody is logged in.
 *
 * getSession() renews an expired one on its way through, so this is also what
 * keeps a member who left the tab open overnight from being turned away.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('could not read the igloo session', error)
    return null
  }
  return data.session?.access_token ?? null
}

/**
 * Start a Kakao login from here.
 *
 * Supabase is the one registered with Kakao, so it handles the round trip and
 * sends the browser back to `redirectTo` with a code on the query string. The
 * client picks that up on its own the next time it loads (detectSessionInUrl),
 * swaps it for a session, and tidies the URL.
 *
 * The redirect has to be an address Supabase's allow list knows about, or it
 * quietly lands on the project's site URL instead.
 */
export async function signInWithKakao() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${window.location.origin}/` },
  })
  if (error) throw error
}
