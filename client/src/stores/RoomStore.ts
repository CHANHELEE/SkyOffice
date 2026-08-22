import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export const roomSlice = createSlice({
  name: 'room',
  initialState: {
    serverConnected: false,
    roomJoined: false,
    roomId: '',
    roomName: '',
    roomDescription: '',
    disconnected: false,
  },
  reducers: {
    setServerConnected: (state, action: PayloadAction<boolean>) => {
      state.serverConnected = action.payload
    },
    setRoomJoined: (state, action: PayloadAction<boolean>) => {
      state.roomJoined = action.payload
    },
    setDisconnected: (state, action: PayloadAction<boolean>) => {
      state.disconnected = action.payload
    },
    setJoinedRoomData: (
      state,
      action: PayloadAction<{ id: string; name: string; description: string }>
    ) => {
      state.roomId = action.payload.id
      state.roomName = action.payload.name
      state.roomDescription = action.payload.description
    },
  },
})

export const { setServerConnected, setRoomJoined, setJoinedRoomData, setDisconnected } =
  roomSlice.actions

export default roomSlice.reducer
