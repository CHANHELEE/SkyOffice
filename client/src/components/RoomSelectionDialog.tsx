import React, { useState } from 'react'
import logo from '../images/logo.png'
import styled from 'styled-components'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import { useAppSelector } from '../hooks'

import phaserGame from '../PhaserGame'
import Bootstrap from '../scenes/Bootstrap'

const Backdrop = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 60px;
  align-items: center;
`

const Wrapper = styled.div`
  background: #222639;
  border-radius: 16px;
  padding: 36px 60px;
  box-shadow: 0px 0px 5px #0000006f;
`

const Title = styled.h1`
  font-size: 24px;
  color: #eee;
  text-align: center;
`

const Subtitle = styled.p`
  margin: 0;
  font-size: 14px;
  color: #c2c2c2;
  text-align: center;
`

const Content = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 20px 0;
  align-items: center;
  justify-content: center;

  img {
    border-radius: 8px;
    height: 120px;
  }
`

const ProgressBarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  h3 {
    color: #33ac96;
  }
`

const ProgressBar = styled(LinearProgress)`
  width: 360px;
`

export default function RoomSelectionDialog() {
  const [password, setPassword] = useState('')
  const [passwordFieldEmpty, setPasswordFieldEmpty] = useState(false)
  const [showSnackbar, setShowSnackbar] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const serverConnected = useAppSelector((state) => state.room.serverConnected)

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
      showError('Trying to connect to server, please try again!')
      return
    }

    const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
    bootstrap.network
      .joinIgloo(password)
      .then(() => bootstrap.launchGame())
      .catch((error) => {
        console.error(error)
        showError(
          error?.code === 403 ? 'Password is incorrect!' : 'Could not enter igloo, please try again!'
        )
      })
  }

  return (
    <>
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => {
          setShowSnackbar(false)
        }}
      >
        <Alert
          severity="error"
          variant="outlined"
          // overwrites the dark theme on render
          style={{ background: '#fdeded', color: '#7d4747' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      <Backdrop>
        <Wrapper>
          <Title>Welcome to igloo</Title>
          <Content onSubmit={handleSubmit}>
            <img src={logo} alt="logo" />
            <Subtitle>이글루 멤버 전용 공간입니다.</Subtitle>
            <TextField
              autoFocus
              fullWidth
              type="password"
              label="Password"
              variant="outlined"
              color="secondary"
              autoComplete="off"
              error={passwordFieldEmpty}
              helperText={passwordFieldEmpty && 'Password is required'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordFieldEmpty(false)
              }}
            />
            <Button variant="contained" color="secondary" type="submit">
              Enter igloo
            </Button>
          </Content>
        </Wrapper>
        {!serverConnected && (
          <ProgressBarWrapper>
            <h3> Connecting to server...</h3>
            <ProgressBar color="secondary" />
          </ProgressBarWrapper>
        )}
      </Backdrop>
    </>
  )
}
