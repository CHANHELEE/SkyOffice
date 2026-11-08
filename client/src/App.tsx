import React, { useEffect } from 'react'
import styled from 'styled-components'

import { useAppSelector } from './hooks'

import RoomSelectionDialog from './components/RoomSelectionDialog'
import LoginDialog from './components/LoginDialog'
import ComputerDialog from './components/ComputerDialog'
import WhiteboardDialog from './components/WhiteboardDialog'
import VideoConnectionDialog from './components/VideoConnectionDialog'
import Chat from './components/Chat'
import HelperButtonGroup from './components/HelperButtonGroup'
import MobileVirtualJoystick from './components/MobileVirtualJoystick'
import DisconnectedDialog from './components/DisconnectedDialog'
import CheckInAlert from './components/CheckInAlert'
import phaserGame from './PhaserGame'

const Backdrop = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`

function App() {
  const loggedIn = useAppSelector((state) => state.user.loggedIn)
  const computerDialogOpen = useAppSelector((state) => state.computer.computerDialogOpen)
  const whiteboardDialogOpen = useAppSelector((state) => state.whiteboard.whiteboardDialogOpen)
  const roomJoined = useAppSelector((state) => state.room.roomJoined)
  const disconnected = useAppSelector((state) => state.room.disconnected)
  const replaced = useAppSelector((state) => state.room.replaced)

  /* Moved to another tab or device: this page is no longer in the room, so it
     should not keep showing it. Left as it was, the last frame - everyone
     standing where they were - stays under the notice and looks like we are
     still inside. Stopping the scene leaves only the backdrop behind it. */
  useEffect(() => {
    if (replaced) phaserGame.scene.stop('game')
  }, [replaced])

  let ui: JSX.Element
  if (replaced) {
    ui = <></>
  } else if (loggedIn) {
    if (computerDialogOpen) {
      /* Render ComputerDialog if user is using a computer. */
      ui = <ComputerDialog />
    } else if (whiteboardDialogOpen) {
      /* Render WhiteboardDialog if user is using a whiteboard. */
      ui = <WhiteboardDialog />
    } else {
      ui = (
        /* Render Chat or VideoConnectionDialog if no dialogs are opened. */
        <>
          <Chat />
          {/* Always rendered: the webcam controls change with the connection,
              but the way back to the igloo web service never goes away. */}
          <VideoConnectionDialog />
          <MobileVirtualJoystick />
        </>
      )
    }
  } else if (roomJoined) {
    /* Render LoginDialog if not logged in but selected a room. */
    ui = <LoginDialog />
  } else {
    /* Render RoomSelectionDialog if yet selected a room. */
    ui = <RoomSelectionDialog />
  }

  return (
    <Backdrop>
      {ui}
      {/* Render HelperButtonGroup if no dialogs are opened. */}
      {!computerDialogOpen && !whiteboardDialogOpen && !replaced && <HelperButtonGroup />}
      {/* outside the switch above: the automatic check-in can land while a
          whiteboard or computer is open */}
      {loggedIn && !replaced && <CheckInAlert />}
      {/* Render on top of everything: nothing works once the connection is gone. */}
      {disconnected && <DisconnectedDialog />}
    </Backdrop>
  )
}

export default App
