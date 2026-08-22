import React, { useState } from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'

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

export default function VideoConnectionDialog() {
  const [connectionWarning, setConnectionWarning] = useState(true)
  return (
    <Backdrop>
      <Wrapper>
        {connectionWarning && (
          <Alert
            severity="warning"
            onClose={() => {
              setConnectionWarning(!connectionWarning)
            }}
          >
            <AlertTitle>알림</AlertTitle>
            웹캠이 연결되지 않았습니다
            <br /> <strong>연결하면 더 편합니다</strong>
          </Alert>
        )}
        <FrostButton
          variant="contained"
          onClick={() => {
            const game = phaserGame.scene.keys.game as Game
            game.network.webRTC?.getUserMedia()
          }}
        >
          웹캠 연결
        </FrostButton>
        <FrostButton variant="contained" onClick={() => openURL(IGLOO_WEB_URL)}>
          이글루 웹사이트
        </FrostButton>
      </Wrapper>
    </Backdrop>
  )
}
