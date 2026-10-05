import React from 'react'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

import { useAppDispatch, useAppSelector } from '../hooks'
import { setCheckInResult } from '../stores/AttendanceStore'

/**
 * What came back from "출석하기", whether the button was pressed or the
 * automatic check-in did it. Rendered for as long as the member is in the
 * room, so it still shows with a whiteboard or computer open.
 */
export default function CheckInAlert() {
  const result = useAppSelector((state) => state.attendance.result)
  const dispatch = useAppDispatch()
  const close = () => dispatch(setCheckInResult(null))

  return (
    /* 결과는 캔버스 위에 잠깐 띄운다. window.alert 는 게임 루프를 멈춰
       세우고, 닫기 전까지 방 안이 얼어붙는다. */
    <Snackbar
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      open={result !== null}
      autoHideDuration={result?.ok ? 3000 : 6000}
      onClose={close}
    >
      <Alert
        severity={result?.ok ? 'success' : 'warning'}
        variant="filled"
        onClose={close}
        style={{ fontFamily: 'var(--body)' }}
      >
        {result?.message}
      </Alert>
    </Snackbar>
  )
}
