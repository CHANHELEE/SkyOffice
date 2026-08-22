import path from 'path'
import dotenv from 'dotenv'
import http from 'http'
import https from 'https'
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

// what the keep-alive ping below (and any uptime monitor) hits
app.get('/healthz', (req, res) => res.send('ok'))

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

/**
 * Render's free instance sleeps after 15 minutes without inbound traffic. That
 * kills every open socket and wipes the room, and members are not told - they
 * just find that nothing works any more.
 *
 * Internal work does not count as traffic, so the server asks for its own public
 * URL to stay awake during the hours members actually use it. Note this can only
 * KEEP the server awake, never wake it: once it sleeps there is no process left
 * to run the timer, so the first member of the day still waits for a cold start.
 */
const KEEP_AWAKE_INTERVAL = 10 * 60 * 1000
const KEEP_AWAKE_FROM_HOUR = 7 // KST
const KEEP_AWAKE_UNTIL_HOUR = 23 // KST

function keepAwakeWhileMembersAreAround(selfUrl: string) {
  setInterval(() => {
    // the instance runs on UTC, members are in KST
    const hourInSeoul = (new Date().getUTCHours() + 9) % 24
    if (hourInSeoul < KEEP_AWAKE_FROM_HOUR || hourInSeoul >= KEEP_AWAKE_UNTIL_HOUR) return

    https
      .get(`${selfUrl}/healthz`, (res) => res.resume())
      .on('error', (error) => console.error('keep-awake ping failed:', error.message))
  }, KEEP_AWAKE_INTERVAL)
}

gameServer
  .listen(port)
  .then(() => {
    console.log(`Listening on ws://localhost:${port}`)
    // create the igloo room up front so it is always there, even before the first member joins
    return matchMaker.createRoom(RoomType.IGLOO, {})
  })
  .then((room) => {
    console.log(`igloo room is ready (roomId: ${room.roomId})`)

    // RENDER_EXTERNAL_URL is injected by Render, so this stays off everywhere else
    const selfUrl = process.env.RENDER_EXTERNAL_URL
    if (selfUrl) {
      keepAwakeWhileMembersAreAround(selfUrl)
      console.log(
        `keeping awake via ${selfUrl}/healthz every ${KEEP_AWAKE_INTERVAL / 60000} minutes, ` +
          `${KEEP_AWAKE_FROM_HOUR}:00-${KEEP_AWAKE_UNTIL_HOUR}:00 KST`
      )
    }
  })
  .catch((error) => {
    console.error('failed to start the server or create the igloo room:', error)
  })
