import React, { useState } from 'react'
import styled from 'styled-components'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import ShareIcon from '@mui/icons-material/Share'
import CloseIcon from '@mui/icons-material/Close'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import GitHubIcon from '@mui/icons-material/GitHub'
import TwitterIcon from '@mui/icons-material/Twitter'
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset'
import VideogameAssetOffIcon from '@mui/icons-material/VideogameAssetOff'

import { setShowJoystick } from '../stores/UserStore'
import { useAppSelector, useAppDispatch } from '../hooks'
import { getAvatarString, getColorByString } from '../util'

const Backdrop = styled.div`
  position: fixed;
  display: flex;
  gap: 10px;
  bottom: 16px;
  right: 16px;
  align-items: flex-end;

  .wrapper-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
`

const Wrapper = styled.div`
  position: relative;
  font-size: 14px;
  color: var(--deep-ice);
  background: #ffffffe6;
  border: 1px solid #2b8fc433;
  box-shadow: 0 12px 30px #0f3a5c26;
  backdrop-filter: blur(6px);
  border-radius: 16px;
  padding: 15px 35px 15px 15px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .close {
    position: absolute;
    top: 15px;
    right: 15px;
  }

  .tip {
    margin-left: 12px;
  }
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
`

const Title = styled.h3`
  font-family: var(--display);
  font-weight: 400;
  font-size: 20px;
  color: var(--deep-ice);
  text-align: center;
`

const RoomName = styled.div`
  margin: 10px 20px;
  max-width: 460px;
  max-height: 150px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;

  h3 {
    font-family: var(--display);
    font-weight: 400;
    font-size: 22px;
    color: var(--deep-ice);
  }
`

const RoomDescription = styled.div`
  margin: 0 20px;
  max-width: 460px;
  max-height: 150px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  font-size: 13px;
  color: var(--deep-ice-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  svg {
    font-size: 14px;
    color: var(--glacier);
  }
`

const StyledFab = styled(Fab)<{ target?: string }>`
  && {
    background: var(--surface-raised);
    color: var(--glacier);
    border: 1px solid var(--ice-edge);
    box-shadow: 0 6px 18px #0f3a5c26;
    transition: color 0.2s, border-color 0.2s, transform 0.2s;

    &:hover {
      color: var(--aurora-mint);
      border-color: var(--ice-edge-strong);
      transform: translateY(-2px);
    }
  }
`

export default function HelperButtonGroup() {
  const [showControlGuide, setShowControlGuide] = useState(false)
  const [showRoomInfo, setShowRoomInfo] = useState(false)
  const showJoystick = useAppSelector((state) => state.user.showJoystick)
  const roomJoined = useAppSelector((state) => state.room.roomJoined)
  const roomId = useAppSelector((state) => state.room.roomId)
  const roomName = useAppSelector((state) => state.room.roomName)
  const roomDescription = useAppSelector((state) => state.room.roomDescription)
  const dispatch = useAppDispatch()

  return (
    <Backdrop>
      <div className="wrapper-group">
        {roomJoined && (
          <Tooltip title={showJoystick ? '가상 조이스틱 끄기' : '가상 조이스틱 켜기'}>
            <StyledFab size="small" onClick={() => dispatch(setShowJoystick(!showJoystick))}>
              {showJoystick ? <VideogameAssetOffIcon /> : <VideogameAssetIcon />}
            </StyledFab>
          </Tooltip>
        )}
        {showRoomInfo && (
          <Wrapper>
            <IconButton className="close" onClick={() => setShowRoomInfo(false)} size="small">
              <CloseIcon />
            </IconButton>
            <RoomName>
              <Avatar style={{ background: getColorByString(roomName) }}>
                {getAvatarString(roomName)}
              </Avatar>
              <h3>{roomName}</h3>
            </RoomName>
            <RoomDescription>
              <AcUnitIcon /> 방 ID: {roomId}
            </RoomDescription>
            <RoomDescription>
              <AcUnitIcon /> 설명: {roomDescription}
            </RoomDescription>
          </Wrapper>
        )}
        {showControlGuide && (
          <Wrapper>
            <Title>조작법</Title>
            <IconButton className="close" onClick={() => setShowControlGuide(false)} size="small">
              <CloseIcon />
            </IconButton>
            <ul>
              <li>
                <strong>W A S D</strong> 또는 <strong>방향키</strong> 로 이동
              </li>
              <li>
                <strong>Space + 방향키</strong> 로 달리기
              </li>
              <li>
                <strong>E</strong> 의자 앞에서 앉기
              </li>
              <li>
                <strong>R</strong> 컴퓨터 앞에서 화면 공유
              </li>
              <li>
                <strong>Z</strong> 바라보는 사람에게 화살 쏘아 깨우기
              </li>
              <li>
                <strong>Enter</strong> 채팅 열기
              </li>
              <li>
                <strong>ESC</strong> 채팅 닫기
              </li>
            </ul>
            <p className="tip">
              <LightbulbIcon />
              가까이 다가가면 화상 연결이 시작됩니다
            </p>
          </Wrapper>
        )}
      </div>
      <ButtonGroup>
        {roomJoined && (
          <>
            <Tooltip title="방 정보">
              <StyledFab
                size="small"
                onClick={() => {
                  setShowRoomInfo(!showRoomInfo)
                  setShowControlGuide(false)
                }}
              >
                <ShareIcon />
              </StyledFab>
            </Tooltip>
            <Tooltip title="조작법">
              <StyledFab
                size="small"
                onClick={() => {
                  setShowControlGuide(!showControlGuide)
                  setShowRoomInfo(false)
                }}
              >
                <HelpOutlineIcon />
              </StyledFab>
            </Tooltip>
          </>
        )}
        <Tooltip title="Visit Our GitHub">
          <StyledFab
            size="small"
            href="https://github.com/kevinshen56714/SkyOffice"
            target="_blank"
          >
            <GitHubIcon />
          </StyledFab>
        </Tooltip>
        <Tooltip title="Follow Us on Twitter">
          <StyledFab size="small" href="https://twitter.com/SkyOfficeApp" target="_blank">
            <TwitterIcon />
          </StyledFab>
        </Tooltip>
      </ButtonGroup>
    </Backdrop>
  )
}
