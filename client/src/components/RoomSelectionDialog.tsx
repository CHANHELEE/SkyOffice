import React, { useCallback, useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import Button from '@mui/material/Button'

import { useAppSelector } from '../hooks'
import { AuthFailure } from '../../../types/Auth'
import { getAccessToken, signInWithKakao, IGLOO_WEB_URL } from '../services/supabase'

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

/** kakao's own yellow - members recognise the button before they read it */
const KakaoButton = styled(Button)`
  && {
    width: 100%;
    font-family: var(--body);
    font-size: 15px;
    font-weight: 500;
    color: #191600;
    background: #fee500;
    border-radius: 14px;
    padding: 11px 0;
    box-shadow: 0 8px 18px #d9c00040;
    transition: background 0.2s, box-shadow 0.2s, transform 0.15s;

    &:hover {
      background: #ffec3d;
      box-shadow: 0 12px 24px #d9c00059;
      transform: translateY(-1px);
    }
  }
`

const Note = styled.p`
  margin: 12px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--deep-ice-dim);
  text-align: center;
`

const Problem = styled.p`
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff1f1cc;
  border: 1px solid #e0808a80;
  font-size: 12.5px;
  line-height: 1.6;
  color: #8f2b34;
  text-align: center;
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

/**
 * The door.
 *
 * There is nothing to type any more. Entry is the igloo login, so this screen
 * only ever does one of three things: send somebody to Kakao, walk them
 * straight in, or explain why it cannot. The explaining is the part worth
 * caring about - "입장할 수 없습니다" with no reason leaves a member with
 * nowhere to go, and the three reasons need three different things done.
 */
type Phase = 'checking' | 'signedOut' | 'ready' | 'entering' | 'blocked'

/** somewhere on the web service the member has to finish something */
type Handover = { label: string; href: string }

export default function RoomSelectionDialog() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [problem, setProblem] = useState('')
  const [handover, setHandover] = useState<Handover | null>(null)
  const serverConnected = useAppSelector((state) => state.room.serverConnected)

  const enter = useCallback(async () => {
    setPhase('entering')
    setProblem('')
    setHandover(null)

    const token = await getAccessToken()
    if (!token) {
      setPhase('signedOut')
      return
    }

    const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
    try {
      await bootstrap.network.joinIgloo(token)
      bootstrap.launchGame()
    } catch (error: any) {
      console.error(error)
      const message = error?.message

      switch (error?.code) {
        case AuthFailure.NOT_SIGNED_IN:
          setProblem(message || '로그인이 만료되었습니다. 다시 로그인해 주세요.')
          setPhase('signedOut')
          return

        case AuthFailure.NOT_ON_ROSTER:
          setProblem(message)
          setHandover({ label: '이글루에서 코드 입력하기', href: `${IGLOO_WEB_URL}/onboarding` })
          setPhase('blocked')
          return

        case AuthFailure.NOT_TAKING_PART:
          setProblem(message)
          setHandover({ label: '내 상태 확인하기', href: `${IGLOO_WEB_URL}/waiting` })
          setPhase('blocked')
          return

        default:
          setProblem(message || '입장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
          setHandover(null)
          setPhase('blocked')
      }
    }
  }, [])

  /* Kakao and Supabase report a refusal on the query string of the address they
     send the browser back to. Without this the member lands on a screen that
     looks exactly like a fresh visit and has no idea the login failed. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const failure = params.get('error_description') || params.get('error')
    if (failure) {
      setProblem('로그인이 완료되지 않았습니다. 다시 시도해 주세요.')
      window.history.replaceState({}, '', window.location.pathname)
    }

    getAccessToken().then((token) => setPhase(token ? 'ready' : 'signedOut'))
  }, [])

  /* Walking in is the whole point, so nobody should have to press anything to
     do it. Waiting on serverConnected matters on the free instance: a cold
     start takes the better part of a minute, and joining before it answers
     just fails. */
  useEffect(() => {
    if (phase === 'ready' && serverConnected) enter()
  }, [phase, serverConnected, enter])

  const signIn = () => {
    setProblem('')
    signInWithKakao().catch((error) => {
      console.error(error)
      setProblem('카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    })
  }

  return (
    <Backdrop>
      <Drawing>
        <Igloo />
      </Drawing>

      <Card>
        <Mark>ARCTIC</Mark>
        <Title>이글루</Title>

        {phase === 'signedOut' && (
          <>
            <Subtitle>
              북극 어딘가, 멤버들만 아는 자리.
              <br />
              이글루 계정으로 들어오세요.
            </Subtitle>
            {problem && <Problem>{problem}</Problem>}
            <KakaoButton variant="contained" onClick={signIn}>
              카카오로 시작하기
            </KakaoButton>
            <Note>이글루 웹사이트와 같은 계정입니다.</Note>
          </>
        )}

        {(phase === 'checking' || phase === 'ready' || phase === 'entering') && (
          <Subtitle>{phase === 'entering' ? '들어가는 중입니다…' : '확인하는 중입니다…'}</Subtitle>
        )}

        {phase === 'blocked' && (
          <>
            <Subtitle>아직 들어올 수 없습니다.</Subtitle>
            {problem && <Problem>{problem}</Problem>}
            {handover ? (
              <EnterButton
                variant="contained"
                onClick={() => {
                  window.location.href = handover.href
                }}
              >
                {handover.label}
              </EnterButton>
            ) : (
              <EnterButton variant="contained" onClick={enter}>
                다시 시도
              </EnterButton>
            )}
          </>
        )}
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
  )
}
