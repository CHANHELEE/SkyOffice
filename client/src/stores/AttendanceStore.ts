import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface CheckInResult {
  ok: boolean
  message: string
}

/**
 * The "출석하기" request and what came back from it.
 *
 * It lives here rather than in the button's component because the button is
 * not the only one who presses it any more - the automatic check-in does too,
 * and has to be able to show the same alert while the button's panel is not
 * even on screen (a whiteboard or computer is open).
 */
export const attendanceSlice = createSlice({
  name: 'attendance',
  initialState: {
    checkingIn: false,
    result: null as CheckInResult | null,
  },
  reducers: {
    setCheckingIn: (state, action: PayloadAction<boolean>) => {
      state.checkingIn = action.payload
    },
    setCheckInResult: (state, action: PayloadAction<CheckInResult | null>) => {
      state.result = action.payload
    },
  },
})

export const { setCheckingIn, setCheckInResult } = attendanceSlice.actions

export default attendanceSlice.reducer
