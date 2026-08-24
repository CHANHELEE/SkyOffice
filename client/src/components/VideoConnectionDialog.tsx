import React, { useState } from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'

import { useAppSelector } from '../hooks'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import { openURL } from '../utils/helpers'
import { glacierButton } from '../styles/polar'

/** the igloo web service members go back to for attendance and submissions */
const IGLOO_WEB_URL = 'https://igloo-five.vercel.app/'

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
`

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  padding: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`

const FrostButton = styled(Button)`
  ${glacierButton};
`

/* the way back to the study site is not a webcam control, so it gets its own
   line and a rule above it */
const Divider = styled.div`
  width: 100%;
  max-width: 132px;
  height: 1px;
  margin: 2px 0;
  background: var(--ice-edge-strong);
`

/**
 * The controls that live in the top-left corner of the room.
 *
 * The link to the igloo web service is always here. It used to share a panel
 * with the "connect your webcam" button, and that whole panel was only rendered
 * while the webcam was off - so connecting a camera took the way back to the
 * study site with it.
 */
export default function VideoConnectionDialog() {
  const [connectionWarning, setConnectionWarning] = useState(true)
  const videoConnected = useAppSelector((state) => state.user.videoConnected)
  const cameraOn = useAppSelector((state) => state.user.cameraOn)
  const cameraLive = videoConnected && cameraOn
  const microphoneOn = useAppSelector((state) => state.user.microphoneOn)

  const webRTC = () => (phaserGame.scene.keys.game as Game).network.webRTC

  return (
    <Backdrop>
      <Wrapper>
        {!cameraLive && connectionWarning && (
          <Alert severity="info" onClose={() => setConnectionWarning(false)}>
            <AlertTitle>카메라 꺼짐</AlertTitle>
            켜기 전까지 다른 멤버에게 보이지 않습니다
          </Alert>
        )}

        <FrostButton
          variant="contained"
          onClick={() => {
            // no stream yet the first time; after that the camera has been
            // released and the browser has to be asked for it again
            if (videoConnected) webRTC()?.toggleCamera()
            else webRTC()?.getUserMedia()
          }}
        >
          {cameraLive ? '카메라 끄기' : '카메라 켜기'}
        </FrostButton>

        {videoConnected && (
          <FrostButton variant="contained" onClick={() => webRTC()?.toggleMicrophone()}>
            {microphoneOn ? '마이크 끄기' : '마이크 켜기'}
          </FrostButton>
        )}

        <Divider />
        <FrostButton variant="contained" onClick={() => openURL(IGLOO_WEB_URL)}>
          이글루 웹사이트
        </FrostButton>
      </Wrapper>
    </Backdrop>
  )
}
