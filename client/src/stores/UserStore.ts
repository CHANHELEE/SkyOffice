import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { sanitizeId } from '../util'
import { BackgroundMode } from '../../../types/BackgroundMode'


/**
 * The igloo is a daytime place. The theme is built around glare off the snow,
 * and there is no way to switch away from it any more - the toggle went with
 * the button that used to sit in the corner.
 */
export function getInitialBackgroundMode() {
  return BackgroundMode.DAY
}

export const userSlice = createSlice({
  name: 'user',
  initialState: {
    backgroundMode: getInitialBackgroundMode(),
    sessionId: '',
    videoConnected: false,
    cameraOn: true,
    microphoneOn: true,
    loggedIn: false,
    /** the name the igloo roster has for me, handed down by the server on join */
    myDisplayName: '',
    playerNameMap: new Map<string, string>(),
    showJoystick: window.innerWidth < 650,
  },
  reducers: {
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload
    },
    setVideoConnected: (state, action: PayloadAction<boolean>) => {
      state.videoConnected = action.payload
    },
    setCameraOn: (state, action: PayloadAction<boolean>) => {
      state.cameraOn = action.payload
    },
    setMicrophoneOn: (state, action: PayloadAction<boolean>) => {
      state.microphoneOn = action.payload
    },
    setLoggedIn: (state, action: PayloadAction<boolean>) => {
      state.loggedIn = action.payload
    },
    setMyDisplayName: (state, action: PayloadAction<string>) => {
      state.myDisplayName = action.payload
    },
    setPlayerNameMap: (state, action: PayloadAction<{ id: string; name: string }>) => {
      state.playerNameMap.set(sanitizeId(action.payload.id), action.payload.name)
    },
    removePlayerNameMap: (state, action: PayloadAction<string>) => {
      state.playerNameMap.delete(sanitizeId(action.payload))
    },
    setShowJoystick: (state, action: PayloadAction<boolean>) => {
      state.showJoystick = action.payload
    },
  },
})

export const {
  setSessionId,
  setVideoConnected,
  setCameraOn,
  setMicrophoneOn,
  setLoggedIn,
  setMyDisplayName,
  setPlayerNameMap,
  removePlayerNameMap,
  setShowJoystick,
} = userSlice.actions

export default userSlice.reducer
