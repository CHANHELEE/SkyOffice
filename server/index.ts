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

/**
 * The Colyseus monitor lists every room and everyone in it, and lets whoever
 * opens it dispose rooms and disconnect people. Upstream mounts it with no
 * authentication at all, which is fine on a laptop and not fine on a public
 * URL - the igloo room is password-protected precisely so outsiders cannot see
 * who is inside.
 *
 * So it is a local-only tool. RENDER_EXTERNAL_URL only exists on Render, and
 * NODE_ENV covers anywhere else this might be deployed.
 */
const isDeployed = Boolean(process.env.RENDER_EXTERNAL_URL) || process.env.NODE_ENV === 'production'
if (!isDeployed) {
  // register colyseus monitor AFTER registering your room handlers
  app.use('/colyseus', monitor())
  console.log('colyseus monitor mounted at /colyseus (local only)')
}

/**
 * Render's free instance sleeps after 15 minutes without inbound traffic. That
 * kills every open socket and wipes the room, and members are not told - they
 * just find that nothing works any more.
 *
 * Internal work does not count as traffic, so the server asks for its own public
 * URL to stay awake during the hours members actually use it. Note this can only
 * KEEP the server awake, never wake it: once it sleeps there is no process left
 * to run the timer, so the first member of the day still waits for a cold start.
 *
 * Sitting in the room is not traffic either. Render counts inbound messages, and
 * people who are reading rather than moving send none - so a room full of members
 * looks exactly like an empty one, and the instance pulls the floor out from under
 * them. That is what dropped members after 20-30 minutes outside study hours, so
 * the ping also goes out whenever anyone is actually inside, whatever the clock says.
 */
const KEEP_AWAKE_INTERVAL = 10 * 60 * 1000
const KEEP_AWAKE_FROM_HOUR = 7 // KST
const KEEP_AWAKE_UNTIL_HOUR = 23 // KST

function keepAwakeWhileMembersAreAround(selfUrl: string, iglooRoomId: string) {
  setInterval(() => {
    // the instance runs on UTC, members are in KST
    const hourInSeoul = (new Date().getUTCHours() + 9) % 24
    const withinStudyHours =
      hourInSeoul >= KEEP_AWAKE_FROM_HOUR && hourInSeoul < KEEP_AWAKE_UNTIL_HOUR

    // getRoomById returns undefined if the room ever went away, and then the
    // clock is the only thing left to go on
    const membersInside = (matchMaker.getRoomById(iglooRoomId)?.clients.length ?? 0) > 0
    if (!withinStudyHours && !membersInside) return

    // worth a line in the log: these are the pings that only happen because
    // somebody is up late, and they are the ones to check if this regresses
    if (!withinStudyHours) {
      console.log(`keep-awake ping outside study hours - ${
        matchMaker.getRoomById(iglooRoomId)?.clients.length
      } member(s) in the room`)
    }

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
      keepAwakeWhileMembersAreAround(selfUrl, room.roomId)
      console.log(
        `keeping awake via ${selfUrl}/healthz every ${KEEP_AWAKE_INTERVAL / 60000} minutes, ` +
          `${KEEP_AWAKE_FROM_HOUR}:00-${KEEP_AWAKE_UNTIL_HOUR}:00 KST, ` +
          `and at any hour while anyone is in the room`
      )
    }
  })
  .catch((error) => {
    console.error('failed to start the server or create the igloo room:', error)
  })
