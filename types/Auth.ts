/**
 * Why the door was closed.
 *
 * The room refuses a join with one of these, and the entry screen is the only
 * place a member ever finds out what happened - so they have to be told apart.
 * "Log in again", "you are not on the roster yet" and "you are on the roster but
 * not taking part" call for three different things to be done about them.
 *
 * Values sit above Colyseus' own 42xx range so they cannot be confused with a
 * matchmaking failure.
 */
export enum AuthFailure {
  /** no token at all, or Supabase would not vouch for the one we got */
  NOT_SIGNED_IN = 4001,
  /** signed in with Kakao, but never linked to the igloo roster */
  NOT_ON_ROSTER = 4002,
  /** on the roster, but pending / paused / withdrawn */
  NOT_TAKING_PART = 4003,
  /** supabase is unreachable or erroring - nothing the member did */
  LOOKUP_FAILED = 4004,
}
