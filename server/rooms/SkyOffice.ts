import { Room, Client, ServerError } from 'colyseus'
import { Dispatcher } from '@colyseus/command'
import { Player, OfficeState, Computer, Whiteboard } from './schema/OfficeState'
import { Message } from '../../types/Messages'
import { IRoomData } from '../../types/Rooms'
import { SessionEnd } from '../../types/Auth'
import { whiteboardRoomIds } from './schema/OfficeState'
import PlayerUpdateCommand from './commands/PlayerUpdateCommand'
import PlayerUpdateNameCommand from './commands/PlayerUpdateNameCommand'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from './commands/ComputerUpdateArrayCommand'
import {
  WhiteboardAddUserCommand,
  WhiteboardRemoveUserCommand,
} from './commands/WhiteboardUpdateArrayCommand'
import ChatMessageUpdateCommand from './commands/ChatMessageUpdateCommand'
import { authenticateMember, IglooAuthError, IglooMember } from '../iglooAuth'
import { requestCheckIn, requestAttendanceStatus } from '../iglooCheckIn'

/**
 * Anything a member sends is checked before it touches the room. Messages come
 * straight off the socket, and a logged-in member can send whatever they like
 * from the developer console - a wrong type assigned to the room state throws,
 * and so does a computer or whiteboard id that does not exist.
 */
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isText = (value: unknown, maxLength = Infinity): value is string =>
  typeof value === 'string' && value.length <= maxLength

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private name: string
  private description: string

  /**
   * onMessage, with the room kept alive whatever the handler does.
   *
   * Colyseus 0.14 calls handlers straight from the socket's message event with
   * nothing around them, so one exception - or one rejected promise from an
   * async handler - took the whole process down: every member thrown out, the
   * chat history gone. The checks in each handler are what should stop bad
   * input; this is what stops the next mistake from costing everyone the room.
   */
  private handle<T = any>(
    type: Message,
    callback: (client: Client, message: T) => void | Promise<void>
  ) {
    this.onMessage(type, (client: Client, message: T) => {
      const report = (error: unknown) =>
        console.error(`message ${Message[type]} from ${client.sessionId} failed:`, error)
      try {
        const result = callback(client, message)
        if (result instanceof Promise) result.catch(report)
      } catch (error) {
        report(error)
      }
    })
  }

  async onCreate(options: IRoomData) {
    const { name, description, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    this.setMetadata({ name, description })

    this.setState(new OfficeState())

    // HARD-CODED: Add 5 computers in a room
    for (let i = 0; i < 5; i++) {
      this.state.computers.set(String(i), new Computer())
    }

    // HARD-CODED: Add 3 whiteboards in a room
    for (let i = 0; i < 3; i++) {
      this.state.whiteboards.set(String(i), new Whiteboard())
    }

    // when a player connect to a computer, add to the computer connectedUser array
    this.handle(Message.CONNECT_TO_COMPUTER, (client, message: { computerId: string }) => {
      if (!isText(message?.computerId)) return
      this.dispatcher.dispatch(new ComputerAddUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player disconnect from a computer, remove from the computer connectedUser array
    this.handle(Message.DISCONNECT_FROM_COMPUTER, (client, message: { computerId: string }) => {
      if (!isText(message?.computerId)) return
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player stop sharing screen
    this.handle(Message.STOP_SCREEN_SHARE, (client, message: { computerId: string }) => {
      const computer = isText(message?.computerId) && this.state.computers.get(message.computerId)
      if (!computer) return
      computer.connectedUser.forEach((id) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === id && cli.sessionId !== client.sessionId) {
            cli.send(Message.STOP_SCREEN_SHARE, client.sessionId)
          }
        })
      })
    })

    // when a player connect to a whiteboard, add to the whiteboard connectedUser array
    this.handle(Message.CONNECT_TO_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      if (!isText(message?.whiteboardId)) return
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), {
        client,
        whiteboardId: message.whiteboardId,
      })
    })

    // when a player disconnect from a whiteboard, remove from the whiteboard connectedUser array
    this.handle(
      Message.DISCONNECT_FROM_WHITEBOARD,
      (client, message: { whiteboardId: string }) => {
        if (!isText(message?.whiteboardId)) return
        this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), {
          client,
          whiteboardId: message.whiteboardId,
        })
      }
    )

    // when receiving updatePlayer message, call the PlayerUpdateCommand
    this.handle(
      Message.UPDATE_PLAYER,
      (client, message: { x: number; y: number; anim: string; running: boolean }) => {
        // anim names are short keys like adam_run_left
        if (!isNumber(message?.x) || !isNumber(message?.y) || !isText(message?.anim, 64)) return
        this.dispatcher.dispatch(new PlayerUpdateCommand(), {
          client,
          x: message.x,
          y: message.y,
          anim: message.anim,
          running: message.running === true,
        })
      }
    )

    /**
     * The client still sends a name, and we still ignore it.
     *
     * The name in the room is whatever the igloo roster says it is, decided in
     * onAuth and kept on the client. Taking the one in the message would hand
     * anyone with the developer console a way to walk in wearing someone else's
     * name, which would undo the point of asking members to log in at all.
     *
     * The message itself has to stay: nothing puts a character on screen for
     * everyone else until the name *changes* from empty, so this is what
     * announces a new arrival.
     */
    this.handle(Message.UPDATE_PLAYER_NAME, (client) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), {
        client,
        name: (client.auth as IglooMember).displayName,
      })
    })

    /**
     * "출석하기" 버튼. 방에 연결된 사람만 여기까지 올 수 있고, 그 사실이
     * 곧 출석의 근거다. 판단은 전부 이글루 웹이 한다 - 시간과 자격을 두
     * 곳에서 따지면 언젠가 어긋난다.
     *
     * 토큰은 입장 때 받은 것을 쓰지 않고 매번 새로 받는다. 모임은 몇 시간씩
     * 이어지는데 그 토큰은 한 시간이면 만료된다.
     */
    this.handle(Message.CHECK_IN, async (client, message: { token?: string }) => {
      const member = client.auth as IglooMember
      const result = await requestCheckIn(message?.token, member.userId)
      console.log(
        `check-in ${member.displayName} - ${result.ok ? (result.already ? 'already' : 'ok') : 'refused'}: ${result.message}`
      )
      client.send(Message.CHECK_IN, result)
    })

    /**
     * 자동 출석이 언제 "출석하기"를 누를지 정하려고 묻는 내 모임 시간.
     * 출석과 같은 이유로 이글루 웹은 방을 거쳐서만 부른다.
     *
     * 이 서버의 시계를 같이 보낸다. 브라우저 시계가 몇 분만 틀려도 출석
     * 창이 열리기 전에 눌러 버리거나 한참 늦게 누르게 되는데, 기준이 되는
     * 시각(opensAt)은 서버 쪽 시계로 정해진 값이다.
     */
    this.handle(Message.ATTENDANCE_STATUS, async (client, message: { token?: string }) => {
      const member = client.auth as IglooMember
      const status = await requestAttendanceStatus(message?.token, member.userId)
      client.send(Message.ATTENDANCE_STATUS, { ...status, serverNow: Date.now() })
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.handle(Message.READY_TO_CONNECT, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.readyToConnect = true
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.handle(Message.VIDEO_CONNECTED, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = true
    })

    // when a player disconnect a stream, broadcast the signal to the other player connected to the stream
    this.handle(Message.DISCONNECT_STREAM, (client, message: { clientId: string }) => {
      if (!isText(message?.clientId)) return
      this.clients.forEach((cli) => {
        if (cli.sessionId === message.clientId) {
          cli.send(Message.DISCONNECT_STREAM, client.sessionId)
        }
      })
    })

    /**
     * A tick from a member who is sitting still. Nothing to do with it - the
     * point is that it arrives: an idle socket carries no application messages
     * at all, and both Render's idle timer and anything else along the path
     * cannot tell a room full of people from an empty one.
     */
    /**
     * Someone turned their camera on or off. The browser gives the far side no
     * usable signal for this - replaceTrack(null) leaves the receiving track
     * live and unmuted, so the last frame just sits there - so it is said out
     * loud and everyone else hides or shows that tile.
     */
    this.handle(Message.CAMERA_STATE, (client, message: { on: boolean }) => {
      if (typeof message?.on !== 'boolean') return
      this.broadcast(
        Message.CAMERA_STATE,
        { clientId: client.sessionId, on: message.on },
        { except: client }
      )
    })

    this.handle(Message.HEARTBEAT, () => {})

    // when a player shoots a wake-up arrow, let everyone else render it.
    // arrows are cosmetic, so they are broadcast rather than kept in room state.
    this.handle(
      Message.SHOOT_ARROW,
      (client, message: { x: number; y: number; direction: string }) => {
        if (!isNumber(message?.x) || !isNumber(message?.y) || !isText(message?.direction, 8)) return
        this.broadcast(
          Message.SHOOT_ARROW,
          {
            clientId: client.sessionId,
            x: message.x,
            y: message.y,
            direction: message.direction,
          },
          { except: client }
        )
      }
    )

    // the shooter detects the hit and reports it. only the player who was hit is
    // told, so the sound stays between the two of them.
    this.handle(Message.ARROW_HIT, (client, message: { targetId: string }) => {
      if (!isText(message?.targetId)) return
      this.clients.forEach((cli) => {
        if (cli.sessionId === message.targetId) {
          cli.send(Message.ARROW_HIT, { clientId: client.sessionId })
        }
      })
    })

    // when a player send a chat message, update the message array and broadcast to all connected clients except the sender
    this.handle(Message.ADD_CHAT_MESSAGE, (client, message: { content: string }) => {
      if (!isText(message?.content)) return
      // update the message array (so that players join later can also see the message)
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), {
        client,
        content: message.content,
      })

      // broadcast to all currently connected clients except the sender (to render in-game dialog on top of the character)
      this.broadcast(
        Message.ADD_CHAT_MESSAGE,
        { clientId: client.sessionId, content: message.content },
        { except: client }
      )
    })
  }

  /**
   * The door. Whatever this returns lands on `client.auth`, so the rest of the
   * room can rely on the member being real without asking again.
   *
   * A failure here is the only thing the entry screen has to go on, so the code
   * has to say which of the three it was - no session, not on the roster, or on
   * the roster but not taking part. They need different things done about them.
   */
  async onAuth(client: Client, options: { token?: string }) {
    try {
      const member = await authenticateMember(options?.token)
      console.log(`auth  ${client.sessionId} - ${member.displayName}`)
      return member
    } catch (error) {
      if (error instanceof IglooAuthError) {
        throw new ServerError(error.code, error.message)
      }
      throw error
    }
  }

  onJoin(client: Client, options: any) {
    const member = client.auth as IglooMember
    console.log(`join  ${client.sessionId} - ${member.displayName}, ${this.clients.length} in the room`)

    /**
     * One member, one way in. A second tab or another device used to put a
     * second character in the room - and check in twice. The newest entry
     * wins: whatever this member already had open is closed, and onLeave clears
     * it off everyone's screen like any other exit.
     *
     * Done here, not in onAuth, so that a join that fails never costs the
     * member the place they already had. userId is the one Supabase vouched
     * for in onAuth - nothing the client said about itself.
     */
    this.clients.forEach((other) => {
      if (other === client || (other.auth as IglooMember | undefined)?.userId !== member.userId) return
      console.log(`replace ${other.sessionId} - ${member.displayName} came in again as ${client.sessionId}`)
      other.leave(SessionEnd.REPLACED)
    })
    this.state.players.set(client.sessionId, new Player())
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this.name,
      description: this.description,
      // the name this member will wear. the client needs it to label its own
      // character, and it has no other way of knowing it.
      displayName: member.displayName,
    })
  }

  onLeave(client: Client, consented: boolean) {
    // consented means they closed the tab or walked out on purpose. anything
    // else is the socket dying under them, which is the thing worth chasing.
    console.log(
      `leave ${client.sessionId} - consented=${consented}, ${this.clients.length} left in the room`
    )
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
    this.state.computers.forEach((computer) => {
      if (computer.connectedUser.has(client.sessionId)) {
        computer.connectedUser.delete(client.sessionId)
      }
    })
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboard.connectedUser.has(client.sessionId)) {
        whiteboard.connectedUser.delete(client.sessionId)
      }
    })
  }

  onDispose() {
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboardRoomIds.has(whiteboard.roomId)) whiteboardRoomIds.delete(whiteboard.roomId)
    })

    console.log('room', this.roomId, 'disposing...')
    this.dispatcher.stop()
  }
}
