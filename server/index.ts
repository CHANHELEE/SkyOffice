import path from 'path'
import dotenv from 'dotenv'
import http from 'http'
import express from 'express'
import cors from 'cors'
import { Server, matchMaker } from 'colyseus'
import { monitor } from '@colyseus/monitor'
import { RoomType } from '../types/Rooms'

// import socialRoutes from "@colyseus/social/express"

import { SkyOffice } from './rooms/SkyOffice'

/**
 * load .env before anything below reads process.env.
 * the path is anchored to this file rather than cwd, because `yarn start`
 * runs from server/ while the Procfile runs from the repo root. a real
 * deployment has no .env, and dotenv then leaves the real env vars alone.
 */
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const port = Number(process.env.PORT || 2567)
const iglooRoomPassword = process.env.IGLOO_ROOM_PASSWORD
if (!iglooRoomPassword) {
  throw new Error(
    'IGLOO_ROOM_PASSWORD must be set - the igloo room password is never committed to the repo'
  )
}
const app = express()

app.use(cors())
app.use(express.json())
// app.use(express.static('dist'))

const server = http.createServer(app)
const gameServer = new Server({
  server,
})

// register room handlers
/**
 * igloo members-only room. it is the only game room on this server:
 * the open public lobby and user-created custom rooms were removed on purpose
 * so that outsiders cannot wander in.
 */
gameServer.define(RoomType.IGLOO, SkyOffice, {
  name: 'igloo',
  description: '이글루 스터디 전용 공간',
  password: iglooRoomPassword,
  autoDispose: false,
})

/**
 * Register @colyseus/social routes
 *
 * - uncomment if you want to use default authentication (https://docs.colyseus.io/server/authentication/)
 * - also uncomment the import statement
 */
// app.use("/", socialRoutes);

// register colyseus monitor AFTER registering your room handlers
app.use('/colyseus', monitor())

gameServer
  .listen(port)
  .then(() => {
    console.log(`Listening on ws://localhost:${port}`)
    // create the igloo room up front so it is always there, even before the first member joins
    return matchMaker.createRoom(RoomType.IGLOO, {})
  })
  .then((room) => {
    console.log(`igloo room is ready (roomId: ${room.roomId})`)
  })
  .catch((error) => {
    console.error('failed to start the server or create the igloo room:', error)
  })
