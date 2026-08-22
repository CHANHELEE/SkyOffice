import React, { useRef, useState, useEffect } from 'react'
import styled from 'styled-components'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import CloseIcon from '@mui/icons-material/Close'
import 'emoji-mart/css/emoji-mart.css'
import { Picker } from 'emoji-mart'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

import { getColorByString } from '../util'
import { useAppDispatch, useAppSelector } from '../hooks'
import { MessageType, setFocused, setShowChat } from '../stores/ChatStore'

const Backdrop = styled.div`
  position: fixed;
  bottom: 60px;
  left: 0;
  height: 400px;
  width: 500px;
  max-height: 50%;
  max-width: 100%;
`

const Wrapper = styled.div`
  position: relative;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
`

const FabWrapper = styled.div`
  margin-top: auto;
`

const ChatHeader = styled.div`
  position: relative;
  height: 35px;
  background: #ffffffd9;
  border: 1px solid #2b8fc433;
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  backdrop-filter: blur(6px);

  h3 {
    font-family: var(--display);
    font-weight: 400;
    color: var(--deep-ice);
    margin: 7px;
    font-size: 16px;
    letter-spacing: 0.04em;
    text-align: center;
  }

  .close {
    position: absolute;
    top: 0;
    right: 0;
  }
`

const ChatBox = styled(Box)`
  height: 100%;
  width: 100%;
  overflow: auto;
  background: #ffffffb8;
  border: 1px solid #2b8fc433;
  border-top: none;
  border-bottom: none;
  backdrop-filter: blur(6px);
`

const MessageWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  padding: 0px 2px;

  p {
    margin: 3px;
    text-shadow: 0.3px 0.3px black;
    font-size: 15px;
    font-weight: bold;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  span {
    color: var(--deep-ice);
    font-weight: normal;
  }

  .notification {
    color: var(--deep-ice-faint);
    font-weight: normal;
    font-style: italic;
  }

  :hover {
    background: #2b8fc414;
  }
`

const InputWrapper = styled.form`
  box-shadow: 0 8px 20px #0f3a5c1f;
  border: 1px solid #2b8fc44d;
  border-radius: 0 0 12px 12px;
  display: flex;
  flex-direction: row;
  background: #ffffffe0;
  backdrop-filter: blur(6px);
`

const InputTextField = styled(InputBase)`
  border-radius: 0 0 12px 12px;
  input {
    padding: 6px;
    font-family: var(--body);
    color: var(--deep-ice);

    &::placeholder {
      color: var(--deep-ice-faint);
      opacity: 1;
    }
  }
`

const EmojiPickerWrapper = styled.div`
  position: absolute;
  bottom: 54px;
  right: 16px;
`

const dateFormatter = new Intl.DateTimeFormat('en', {
  timeStyle: 'short',
  dateStyle: 'short',
})

const Message = ({ chatMessage, messageType }) => {
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <MessageWrapper
      onMouseEnter={() => {
        setTooltipOpen(true)
      }}
      onMouseLeave={() => {
        setTooltipOpen(false)
      }}
    >
      <Tooltip
        open={tooltipOpen}
        title={dateFormatter.format(chatMessage.createdAt)}
        placement="right"
        arrow
      >
        {messageType === MessageType.REGULAR_MESSAGE ? (
          <p
            style={{
              color: getColorByString(chatMessage.author),
            }}
          >
            {chatMessage.author}: <span>{chatMessage.content}</span>
          </p>
        ) : (
          <p className="notification">
            {chatMessage.author} {chatMessage.content}
          </p>
        )}
      </Tooltip>
    </MessageWrapper>
  )
}

export default function Chat() {
  const [inputValue, setInputValue] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [readyToSubmit, setReadyToSubmit] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatMessages = useAppSelector((state) => state.chat.chatMessages)
  const focused = useAppSelector((state) => state.chat.focused)
  const showChat = useAppSelector((state) => state.chat.showChat)
  const dispatch = useAppDispatch()
  const game = phaserGame.scene.keys.game as Game

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // move focus back to the game
      inputRef.current?.blur()
      dispatch(setShowChat(false))
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // this is added because without this, 2 things happen at the same
    // time when Enter is pressed, (1) the inputRef gets focus (from
    // useEffect) and (2) the form gets submitted (right after the input
    // gets focused)
    if (!readyToSubmit) {
      setReadyToSubmit(true)
      return
    }
    // move focus back to the game
    inputRef.current?.blur()

    const val = inputValue.trim()
    setInputValue('')
    if (val) {
      game.network.addChatMessage(val)
      game.myPlayer.updateDialogBubble(val)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus()
    }
  }, [focused])

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages, showChat])

  return (
    <Backdrop>
      <Wrapper>
        {showChat ? (
          <>
            <ChatHeader>
              <h3>모닥불</h3>
              <IconButton
                aria-label="close dialog"
                className="close"
                onClick={() => dispatch(setShowChat(false))}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </ChatHeader>
            <ChatBox>
              {chatMessages.map(({ messageType, chatMessage }, index) => (
                <Message chatMessage={chatMessage} messageType={messageType} key={index} />
              ))}
              <div ref={messagesEndRef} />
              {showEmojiPicker && (
                <EmojiPickerWrapper>
                  <Picker
                    theme="dark"
                    showSkinTones={false}
                    showPreview={false}
                    onSelect={(emoji) => {
                      setInputValue(inputValue + emoji.native)
                      setShowEmojiPicker(!showEmojiPicker)
                      dispatch(setFocused(true))
                    }}
                    exclude={['recent', 'flags']}
                  />
                </EmojiPickerWrapper>
              )}
            </ChatBox>
            <InputWrapper onSubmit={handleSubmit}>
              <InputTextField
                inputRef={inputRef}
                autoFocus={focused}
                fullWidth
                placeholder="Enter를 눌러 이야기하기"
                value={inputValue}
                onKeyDown={handleKeyDown}
                onChange={handleChange}
                onFocus={() => {
                  if (!focused) {
                    dispatch(setFocused(true))
                    setReadyToSubmit(true)
                  }
                }}
                onBlur={() => {
                  dispatch(setFocused(false))
                  setReadyToSubmit(false)
                }}
              />
              <IconButton aria-label="emoji" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <InsertEmoticonIcon />
              </IconButton>
            </InputWrapper>
          </>
        ) : (
          <FabWrapper>
            <Fab
              color="secondary"
              aria-label="showChat"
              onClick={() => {
                dispatch(setShowChat(true))
                dispatch(setFocused(true))
              }}
            >
              <ChatBubbleOutlineIcon />
            </Fab>
          </FabWrapper>
        )}
      </Wrapper>
    </Backdrop>
  )
}
