import React, { useEffect, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import { useAppSelector } from '../hooks'
import { frostField } from '../styles/polar'

import phaserGame from '../PhaserGame'
import Bootstrap from '../scenes/Bootstrap'
import Igloo from './Igloo'

const breathe = keyframes`
  0%, 100% { opacity: 0.72; }
  43% { opacity: 1; }
  67% { opacity: 0.86; }
`

/* the entrance animation has to carry the centring transform, or it lands on
   `transform: none` and knocks the igloo off the middle of the screen */
const riseIntoView = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 20px));
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
`

const Backdrop = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  animation: ${riseIntoView} 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
`

/**
 * The igloo is the picture and the card is the door - putting the form on the
 * dome itself meant text over block seams and a button stuck to the snow like
 * a sticker.
 */
const Drawing = styled.div`
  width: 330px;
  margin-bottom: -18px;
  filter: drop-shadow(0 14px 22px #0f3a5c1f);
`

const Card = styled.div`
  position: relative;
  width: 320px;
  padding: 26px 30px 28px;
  border-radius: 22px;
  background: var(--panel-bg);
  border: 1px solid var(--ice-edge);
  box-shadow: var(--panel-shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
`

const Mark = styled.div`
  font-family: var(--display);
  font-size: 11px;
  letter-spacing: 0.42em;
  text-indent: 0.42em;
  color: var(--glacier);
  opacity: 0.8;
  margin-bottom: 2px;
`

const Title = styled.h1`
  margin: 0 0 4px;
  font-family: var(--display);
  font-weight: 400;
  font-size: 28px;
  letter-spacing: 0.01em;
  color: var(--deep-ice);
  text-align: center;
  text-shadow: 0 2px 0 #fff;
`

const Subtitle = styled.p`
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--deep-ice-dim);
  text-align: center;
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: stretch;
  width: 100%;
`

const PasswordField = styled(TextField)`
  ${frostField};
  width: 100%;
`

const EnterButton = styled(Button)`
  && {
    font-family: var(--display);
    font-size: 16px;
    letter-spacing: 0.03em;
    color: #ffffff;
    background: linear-gradient(180deg, #58b6e0, #2b8fc4);
    border-radius: 14px;
    padding: 10px 0;
    box-shadow: 0 8px 18px #2b8fc44d, inset 0 1px 0 #ffffff59;
    transition: background 0.2s, box-shadow 0.2s, transform 0.15s;

    &:hover {
      background: linear-gradient(180deg, #6ac2e8, #2f9bd2);
      box-shadow: 0 12px 24px #2b8fc466, inset 0 1px 0 #ffffff73;
      transform: translateY(-1px);
    }
  }
`

/* The wake-up has no progress to report - Render gives no signal between "cold"
   and "up" - so the bar sweeps instead of filling. A bar that creeps to 90% and
   sits there is a worse lie than one that plainly says "still working". */
const sweep = keyframes`
  from { transform: translateX(-105%); }
  to { transform: translateX(305%); }
`

/* tinted rather than white: this sits under a white card on a white screen, and
   the whole point is that you notice it */
const Status = styled.div`
  width: 320px;
  padding: 16px 18px 18px;
  border-radius: 18px;
  background: linear-gradient(160deg, #e8f6ff 0%, #d6ecfb 100%);
  border: 1px solid var(--ice-edge-strong);
  box-shadow: 0 14px 34px #0f3a5c26, inset 0 1px 0 #ffffffe6;
  display: flex;
  flex-direction: column;
  gap: 11px;
`
const StatusHead = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: var(--display);
  font-size: 16px;
  letter-spacing: 0.01em;
  color: var(--deep-ice);
`

/** the one light on while we reach the server */
const Pulse = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--glacier);
  box-shadow: 0 0 12px #2b8fc4a6;
  animation: ${breathe} 1.6s ease-in-out infinite;
  flex: none;
`
const Track = styled.div`
  height: 8px;
  border-radius: 999px;
  background: #ffffffb8;
  border: 1px solid var(--ice-edge);
  overflow: hidden;
`
const StatusNote = styled.p`
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--deep-ice-dim);
`
const Bar = styled.div`
  width: 33%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7fd5f0, var(--glacier), #7fd5f0);
  box-shadow: 0 0 10px #2b8fc466;
  animation: ${sweep} 1.5s cubic-bezier(0.62, 0.02, 0.35, 1) infinite;
`

export default function RoomSelectionDialog() {
  const [password, setPassword] = useState('')
  const [passwordFieldEmpty, setPasswordFieldEmpty] = useState(false)
  const [showSnackbar, setShowSnackbar] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const serverConnected = useAppSelector((state) => state.room.serverConnected)
  const passwordRef = useRef<HTMLInputElement>(null)

  /**
   * Put the caret in the field so you can type and hit Enter without clicking.
   * The second pass is for the boot frames: Phaser settling its canvas used to
   * blow focus back to <body>, and typing silently went nowhere.
   */
  useEffect(() => {
    const focus = () => passwordRef.current?.focus()
    focus()
    const settle = window.setTimeout(focus, 120)
    return () => window.clearTimeout(settle)
  }, [])

  const showError = (message: string) => {
    setSnackbarMessage(message)
    setShowSnackbar(true)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!password) {
      setPasswordFieldEmpty(true)
      return
    }
    setPasswordFieldEmpty(false)

    if (!serverConnected) {
      showError('서버에 연결하는 중입니다. 잠시 후 다시 시도해 주세요.')
      return
    }

    const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
    bootstrap.network
      .joinIgloo(password)
      .then(() => bootstrap.launchGame())
      .catch((error) => {
        console.error(error)
        showError(
          error?.code === 403
            ? '비밀번호가 올바르지 않습니다.'
            : '입장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        )
      })
  }

  return (
    <>
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSnackbar(false)}
      >
        <Alert
          severity="error"
          variant="outlined"
          style={{
            background: '#fff1f1f2',
            color: '#a3323b',
            borderColor: '#e0808a',
            fontFamily: 'var(--body)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Backdrop>
        <Drawing>
          <Igloo />
        </Drawing>

        <Card>
          <Mark>ARCTIC</Mark>
          <Title>이글루</Title>
          <Subtitle>
            북극 어딘가, 멤버들만 아는 자리.
            <br />
            비밀번호를 넣고 안으로 들어오세요.
          </Subtitle>
          <Form onSubmit={handleSubmit}>
            <PasswordField
              inputRef={passwordRef}
              fullWidth
              size="small"
              type="password"
              label="비밀번호"
              variant="outlined"
              autoComplete="off"
              error={passwordFieldEmpty}
              helperText={passwordFieldEmpty && '비밀번호를 입력해 주세요'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordFieldEmpty(false)
              }}
            />
            <EnterButton variant="contained" type="submit">
              들어가기
            </EnterButton>
          </Form>
        </Card>

        {!serverConnected && (
          <Status>
            <StatusHead>
              <Pulse />
              서버를 깨우는 중입니다
            </StatusHead>
            <Track>
              <Bar />
            </Track>
            <StatusNote>최대 1분 가까이 걸릴 수 있어요.</StatusNote>
          </Status>
        )}
      </Backdrop>
    </>
  )
}
