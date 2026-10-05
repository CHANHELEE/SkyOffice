import store from '../stores'
import { setCheckingIn, setCheckInResult } from '../stores/AttendanceStore'
import { AutoCheckInPlan, planAutoCheckIn } from '../utils/autoCheckInPlan'
import type Network from './Network'

/** how often to look at the clock. a hidden tab stretches this to about a minute */
const TICK_MS = 15 * 1000

/** how often to ask again - the member may pick or change today's time while inside */
const REFRESH_MS = 10 * 60 * 1000

/**
 * Press "출석하기" and show what came back.
 *
 * The button and the timer both come through here, so the alert is the same
 * either way, and a press while one is already on its way is dropped instead
 * of sending a second.
 */
export async function checkInAndReport(network: Network) {
  if (store.getState().attendance.checkingIn) return
  store.dispatch(setCheckingIn(true))
  try {
    store.dispatch(setCheckInResult(await network.checkIn()))
  } finally {
    store.dispatch(setCheckingIn(false))
  }
}

/**
 * Checks in for a member who is in the room nine minutes before their meeting,
 * so being there is enough and nobody has to remember the button.
 *
 * It runs here in the browser on purpose: only somebody whose tab is open in
 * the room gets checked in, which is the whole meaning of attendance. The
 * request itself takes the same road as the button, through the room.
 *
 * Somebody who comes in after that point is checked in as they arrive - they
 * are in the room, and the igloo web service decides on time or late.
 */
export default class AutoCheckIn {
  private plan: AutoCheckInPlan | null = null
  /** meeting starts already tried, so a refusal is not repeated every refresh */
  private tried = new Set<number>()
  private tick?: number
  private refresh?: number

  constructor(private network: Network) {}

  start() {
    this.stop()
    this.refreshPlan()
    this.refresh = window.setInterval(() => this.refreshPlan(), REFRESH_MS)
    this.tick = window.setInterval(() => this.checkInIfDue(), TICK_MS)
  }

  stop() {
    window.clearInterval(this.tick)
    window.clearInterval(this.refresh)
    this.tick = undefined
    this.refresh = undefined
  }

  private async refreshPlan() {
    const status = await this.network.attendanceStatus()
    // a failed lookup says nothing about the meeting; keep what we had
    if (!status.ok) return

    this.plan = planAutoCheckIn(status, Date.now())
    if (this.plan) {
      console.info('auto check-in at', new Date(this.plan.at).toLocaleTimeString())
    }
    this.checkInIfDue()
  }

  private checkInIfDue() {
    const plan = this.plan
    if (!plan || Date.now() < plan.at || this.tried.has(plan.startsAt)) return
    this.tried.add(plan.startsAt)
    checkInAndReport(this.network)
  }
}
