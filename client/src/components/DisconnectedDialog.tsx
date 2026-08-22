import React from 'react'
import styled from 'styled-components'
import Button from '@mui/material/Button'

/** where members get back in, wherever they happened to be running this from */
const IGLOO_SKYOFFICE_URL = 'https://igloo-skyoffice.onrender.com/'

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20000;
  background: #0e0f1acc;
  display: flex;
  align-items: center;
  justify-content: center;
`

const Wrapper = styled.div`
  background: #222639;
  border-radius: 16px;
  padding: 32px 40px;
  margin: 0 16px;
  max-width: 420px;
  box-shadow: 0px 0px 5px #0000006f;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  color: #eee;
  text-align: center;
`

const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #c2c2c2;
  text-align: center;
`

const Link = styled.a`
  font-size: 13px;
  color: #33ac96;
  overflow-wrap: anywhere;
`

export default function DisconnectedDialog() {
  return (
    <Backdrop>
      <Wrapper>
        <Title>서버와의 연결이 끊어졌습니다</Title>
        <Description>
          채팅과 다른 멤버의 움직임이 더 이상 전달되지 않습니다.
          <br />
          아래 버튼을 눌러 다시 입장해 주세요.
        </Description>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            window.location.href = IGLOO_SKYOFFICE_URL
          }}
        >
          다시 입장하기
        </Button>
        <Link href={IGLOO_SKYOFFICE_URL}>{IGLOO_SKYOFFICE_URL}</Link>
      </Wrapper>
    </Backdrop>
  )
}
