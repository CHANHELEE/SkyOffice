import Phaser from 'phaser'

// import { debugDraw } from '../utils/debug'
import { createCharacterAnims } from '../anims/CharacterAnims'

import Item from '../items/Item'
import Chair from '../items/Chair'
import Computer from '../items/Computer'
import Whiteboard from '../items/Whiteboard'
import VendingMachine from '../items/VendingMachine'
import Arrow, {
  ARROW_HIT_RADIUS,
  ARROW_TEXTURE,
  arrowSpawnPoint,
  createArrowTexture,
  Direction,
} from '../items/Arrow'
import { playPokeEffect, playPokeSound } from '../utils/poke'
import '../characters/MyPlayer'
import '../characters/OtherPlayer'
import MyPlayer from '../characters/MyPlayer'
import OtherPlayer from '../characters/OtherPlayer'
import PlayerSelector from '../characters/PlayerSelector'
import Network from '../services/Network'
import { IPlayer } from '../../../types/IOfficeState'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
import { ItemType } from '../../../types/Items'

import store from '../stores'
import { setFocused, setShowChat } from '../stores/ChatStore'
import { NavKeys, Keyboard } from '../../../types/KeyboardState'

/** keeps someone from spraying arrows by holding Z down */
const ARROW_COOLDOWN = 400

/**
 * The meeting room, turned into a place to sit round a fire.
 *
 * The upstream map has a boardroom here - a long table with eight office chairs
 * - which is the least igloo-like thing in the building. Rather than editing
 * map.json and carrying that conflict against upstream forever, the objects
 * inside this rectangle are skipped as the map is built and the fire and
 * cushions are placed in code.
 */
const FIRE_ROOM = { left: 250, top: 600, right: 545, bottom: 780 }

const inFireRoom = (x: number, y: number) =>
  x >= FIRE_ROOM.left && x <= FIRE_ROOM.right && y >= FIRE_ROOM.top && y <= FIRE_ROOM.bottom

/**
 * The middle of the room, measured rather than guessed: the walls sit at x 176
 * and 624, and at y 530 and 786, so the floor's centre is here. The first
 * attempt put the fire where the old table was, which was well below centre.
 */
const FIRE_CENTRE = { x: 400, y: 664 }
/** drawn at native 64px - scaling pixel art by 2.6 smeared every pixel */
const FIRE_SCALE = 1

/** how far the cushions sit from the fire */
const CUSHION_RADIUS = 82
const CUSHION_COUNT = 8

type Facing = 'up' | 'down' | 'left' | 'right'

/**
 * Cushions on an exact circle, each turned to face the fire. The angles are
 * computed rather than hand-placed, so the ring is actually round - the
 * hand-written offsets it replaces were visibly lopsided.
 */
function cushionRing() {
  const seats: { x: number; y: number; direction: Facing }[] = []

  for (let i = 0; i < CUSHION_COUNT; i++) {
    // start at the top so a cushion sits squarely above and below the fire
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / CUSHION_COUNT
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    // You sit looking inward, so face back along the radius. The epsilon matters:
    // on the exact diagonals |dx| and |dy| differ only in the last float bit, and
    // without it symmetric cushions picked opposite axes. Ties go to up/down.
    const direction: Facing =
      Math.abs(dx) > Math.abs(dy) + 1e-6 ? (dx > 0 ? 'left' : 'right') : dy > 0 ? 'up' : 'down'

    seats.push({
      x: FIRE_CENTRE.x + dx * CUSHION_RADIUS,
      y: FIRE_CENTRE.y + dy * CUSHION_RADIUS,
      direction,
    })
  }

  return seats
}

export default class Game extends Phaser.Scene {
  network!: Network
  private cursors!: NavKeys
  private keyE!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private keyZ!: Phaser.Input.Keyboard.Key
  private map!: Phaser.Tilemaps.Tilemap
  /** arrows I fired - only these are checked against other players */
  private myArrows!: Phaser.Physics.Arcade.Group
  /** arrows other people fired - drawn only, their shooter decides the hit */
  private otherArrows!: Phaser.Physics.Arcade.Group
  private lastArrowShotAt = 0
  myPlayer!: MyPlayer
  private playerSelector!: Phaser.GameObjects.Zone
  private otherPlayers!: Phaser.Physics.Arcade.Group
  private otherPlayerMap = new Map<string, OtherPlayer>()
  computerMap = new Map<string, Computer>()
  private whiteboardMap = new Map<string, Whiteboard>()

  constructor() {
    super('game')
  }

  registerKeys() {
    this.cursors = {
      ...this.input.keyboard.createCursorKeys(),
      ...(this.input.keyboard.addKeys('W,S,A,D') as Keyboard),
    }

    // maybe we can have a dedicated method for adding keys if more keys are needed in the future
    this.keyE = this.input.keyboard.addKey('E')
    this.keyR = this.input.keyboard.addKey('R')
    this.keyZ = this.input.keyboard.addKey('Z')
    // One press, one arrow. Polling JustDown() in update() let a single press
    // through several times over, and a 400ms cooldown is not tight enough to
    // hide that - two arrows went out. The key's own down event fires once per
    // press, because Phaser only raises it when the key was not already down.
    // registerKeys() can run again on a rejoin, so drop the old listener first.
    this.keyZ.removeAllListeners('down')
    this.keyZ.on('down', this.shootArrow, this)
    this.input.keyboard.disableGlobalCapture()
    this.input.keyboard.on('keydown-ENTER', (event) => {
      store.dispatch(setShowChat(true))
      store.dispatch(setFocused(true))
    })
    this.input.keyboard.on('keydown-ESC', (event) => {
      store.dispatch(setShowChat(false))
    })
  }

  disableKeys() {
    this.input.keyboard.enabled = false
  }

  enableKeys() {
    this.input.keyboard.enabled = true
  }

  create(data: { network: Network }) {
    if (!data.network) {
      throw new Error('server instance missing')
    } else {
      this.network = data.network
    }

    createCharacterAnims(this.anims)

    this.map = this.make.tilemap({ key: 'tilemap' })
    const FloorAndGround = this.map.addTilesetImage('FloorAndGround', 'tiles_wall')

    const groundLayer = this.map.createLayer('Ground', FloorAndGround)
    groundLayer.setCollisionByProperty({ collides: true })

    // debugDraw(groundLayer, this)

    this.myPlayer = this.add.myPlayer(705, 500, 'adam', this.network.mySessionId)
    this.playerSelector = new PlayerSelector(this, 0, 0, 16, 16)

    // import chair objects from Tiled map to Phaser
    const chairs = this.physics.add.staticGroup({ classType: Chair })
    const chairLayer = this.map.getObjectLayer('Chair')
    chairLayer.objects.forEach((chairObj) => {
      if (inFireRoom(chairObj.x!, chairObj.y!)) return
      const item = this.addObjectFromTiled(chairs, chairObj, 'chairs', 'chair') as Chair
      // custom properties[0] is the object direction specified in Tiled
      item.itemDirection = chairObj.properties[0].value
    })

    // import computers objects from Tiled map to Phaser
    const computers = this.physics.add.staticGroup({ classType: Computer })
    const computerLayer = this.map.getObjectLayer('Computer')
    computerLayer.objects.forEach((obj, i) => {
      const item = this.addObjectFromTiled(computers, obj, 'computers', 'computer') as Computer
      item.setDepth(item.y + item.height * 0.27)
      const id = `${i}`
      item.id = id
      this.computerMap.set(id, item)
    })

    // import whiteboards objects from Tiled map to Phaser
    const whiteboards = this.physics.add.staticGroup({ classType: Whiteboard })
    const whiteboardLayer = this.map.getObjectLayer('Whiteboard')
    whiteboardLayer.objects.forEach((obj, i) => {
      const item = this.addObjectFromTiled(
        whiteboards,
        obj,
        'whiteboards',
        'whiteboard'
      ) as Whiteboard
      const id = `${i}`
      item.id = id
      this.whiteboardMap.set(id, item)
    })

    // import vending machine objects from Tiled map to Phaser
    const vendingMachines = this.physics.add.staticGroup({ classType: VendingMachine })
    const vendingMachineLayer = this.map.getObjectLayer('VendingMachine')
    vendingMachineLayer.objects.forEach((obj, i) => {
      this.addObjectFromTiled(vendingMachines, obj, 'vendingmachines', 'vendingmachine')
    })

    // import other objects from Tiled map to Phaser
    this.addGroupFromTiled('Wall', 'tiles_wall', 'FloorAndGround', false)
    this.addGroupFromTiled('Objects', 'office', 'Modern_Office_Black_Shadow', false)
    this.addGroupFromTiled('ObjectsOnCollide', 'office', 'Modern_Office_Black_Shadow', true)
    this.addGroupFromTiled('GenericObjects', 'generic', 'Generic', false)
    this.addGroupFromTiled('GenericObjectsOnCollide', 'generic', 'Generic', true)
    this.addGroupFromTiled('Basement', 'basement', 'Basement', true)

    this.otherPlayers = this.physics.add.group({ classType: OtherPlayer })

    // The office tileset is the upstream art - there is no arctic tileset in
    // the repo and pixel art is not something we can author here. Bright sky
    // around the map plus snow falling through it is what carries the theme into
    // the room, without dulling the pixel art underneath.
    this.cameras.main.setBackgroundColor('#bfe4f7')
    this.letItSnowIndoors()

    this.lightTheFire(chairs)

    createArrowTexture(this)
    this.myArrows = this.physics.add.group({ classType: Arrow, runChildUpdate: true })
    this.otherArrows = this.physics.add.group({ classType: Arrow, runChildUpdate: true })
    // arrows should not travel through walls into the next room
    this.physics.add.collider(this.myArrows, groundLayer, this.handleArrowHitWall, undefined, this)
    this.physics.add.collider(
      this.otherArrows,
      groundLayer,
      this.handleArrowHitWall,
      undefined,
      this
    )
    this.physics.add.overlap(
      this.myArrows,
      this.otherPlayers,
      this.handleArrowHitPlayer,
      undefined,
      this
    )

    this.cameras.main.zoom = 1.5
    this.cameras.main.startFollow(this.myPlayer, true)

    this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], groundLayer)
    this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], vendingMachines)

    this.physics.add.overlap(
      this.playerSelector,
      [chairs, computers, whiteboards, vendingMachines],
      this.handleItemSelectorOverlap,
      undefined,
      this
    )

    this.physics.add.overlap(
      this.myPlayer,
      this.otherPlayers,
      this.handlePlayersOverlap,
      undefined,
      this
    )

    // register network event listeners
    this.network.onPlayerJoined(this.handlePlayerJoined, this)
    this.network.onPlayerLeft(this.handlePlayerLeft, this)
    this.network.onMyPlayerReady(this.handleMyPlayerReady, this)
    this.network.onMyPlayerVideoConnected(this.handleMyVideoConnected, this)
    this.network.onPlayerUpdated(this.handlePlayerUpdated, this)
    this.network.onItemUserAdded(this.handleItemUserAdded, this)
    this.network.onItemUserRemoved(this.handleItemUserRemoved, this)
    this.network.onChatMessageAdded(this.handleChatMessageAdded, this)
    this.network.onArrowShot(this.handleArrowShot, this)
    this.network.onArrowHitMe(this.handleArrowHitMe, this)

    // now that the listeners are up, draw whoever was already in the room
    this.network.announceExistingPlayers()
  }

  /** fire a wake-up arrow in the direction my player is facing */
  private shootArrow() {
    // the key is live from the moment it is registered, the player is not
    if (!this.myPlayer || !this.network) return

    const now = this.time.now
    if (now - this.lastArrowShotAt < ARROW_COOLDOWN) return
    this.lastArrowShotAt = now

    const direction = this.myPlayer.facingDirection
    const { x, y } = arrowSpawnPoint(this.myPlayer.x, this.myPlayer.y, direction)
    this.spawnArrow(this.myArrows, this.network.mySessionId, x, y, direction)
    this.network.shootArrow(x, y, direction)
  }

  private spawnArrow(
    group: Phaser.Physics.Arcade.Group,
    ownerId: string,
    x: number,
    y: number,
    direction: Direction
  ) {
    const arrow = group.get(x, y, ARROW_TEXTURE) as Arrow
    if (!arrow) return
    arrow.setActive(true).setVisible(true)
    arrow.enableBody(true, x, y, true, true)
    arrow.fire(ownerId, direction)
  }

  // someone else fired - render it, but let their client decide what it hits
  private handleArrowShot(clientId: string, x: number, y: number, direction: string) {
    this.spawnArrow(this.otherArrows, clientId, x, y, direction as Direction)
  }

  private handleArrowHitWall(arrow: Phaser.GameObjects.GameObject) {
    (arrow as Arrow).destroy()
  }

  private handleArrowHitPlayer(arrowObject, otherPlayerObject) {
    const arrow = arrowObject as Arrow
    const otherPlayer = otherPlayerObject as OtherPlayer
    if (!arrow.active) return
    // other players carry an oversized body so webrtc calls connect on approach,
    // which would count as a hit from way across the room. measure for real.
    const distance = Phaser.Math.Distance.Between(arrow.x, arrow.y, otherPlayer.x, otherPlayer.y)
    if (distance > ARROW_HIT_RADIUS) return

    arrow.destroy()
    playPokeEffect(this, otherPlayer.x, otherPlayer.y)
    playPokeSound()
    this.network.reportArrowHit(otherPlayer.playerId)
  }

  // the server only sends this to whoever was hit
  private handleArrowHitMe(clientId: string) {
    playPokeEffect(this, this.myPlayer.x, this.myPlayer.y)
    playPokeSound()
    this.cameras.main.shake(250, 0.006)
  }

  /**
   * The fire in the middle of what used to be the boardroom, with cushions round
   * it. The cushions are Chair items, so sitting on one works exactly the way
   * sitting on an office chair does - same prompt, same animation.
   */
  private lightTheFire(chairs: Phaser.Physics.Arcade.StaticGroup) {
    if (!this.anims.exists('campfire_burn')) {
      this.anims.create({
        key: 'campfire_burn',
        frames: this.anims.generateFrameNumbers('campfire', { start: 0, end: 5 }),
        frameRate: 9,
        repeat: -1,
      })
    }

    cushionRing().forEach((seat) => {
      const cushion = chairs.get(seat.x, seat.y, 'cushions') as Chair
      cushion.itemDirection = seat.direction
      cushion.setDepth(seat.y)
    })

    const fire = this.add
      .sprite(FIRE_CENTRE.x, FIRE_CENTRE.y, 'campfire')
      .setScale(FIRE_SCALE)
      // the hearth sits on the floor and the flame rises from it, so anchor the
      // sprite at the stones rather than at its middle
      .setOrigin(0.5, 0.8)
      .setDepth(FIRE_CENTRE.y)
    fire.play('campfire_burn')
  }

  /**
   * Snow drifting across the room. Fixed to the camera rather than the world so
   * it reads as weather in front of you, not as objects lying on the floor.
   */
  private letItSnowIndoors() {
    const { width, height } = this.cameras.main

    for (let i = 0; i < 130; i++) {
      // a spread of sizes: the big ones are close and read clearly, the small
      // ones sit further back. all of them need an outline, because white on
      // white ice was invisible before.
      const size = Phaser.Math.RND.between(2, 5)
      const near = size / 5

      const flake = this.add
        .circle(
          Phaser.Math.RND.between(0, width),
          Phaser.Math.RND.between(0, height),
          size / 2,
          0xffffff,
          0.55 + near * 0.4
        )
        .setStrokeStyle(1, 0x9dc4de, 0.5 + near * 0.35)
        .setScrollFactor(0)
        .setDepth(9000)

      this.tweens.add({
        targets: flake,
        y: height + 10,
        x: `+=${Phaser.Math.RND.between(-40, 90)}`,
        duration: Phaser.Math.RND.between(4200, 9000) / near,
        delay: Phaser.Math.RND.between(0, 6000),
        repeat: -1,
        onRepeat: () => {
          flake.y = -10
          flake.x = Phaser.Math.RND.between(-40, width)
        },
      })
    }
  }

  private handleItemSelectorOverlap(playerSelector, selectionItem) {
    const currentItem = playerSelector.selectedItem as Item
    // currentItem is undefined if nothing was perviously selected
    if (currentItem) {
      // if the selection has not changed, do nothing
      if (currentItem === selectionItem || currentItem.depth >= selectionItem.depth) {
        return
      }
      // if selection changes, clear pervious dialog
      if (this.myPlayer.playerBehavior !== PlayerBehavior.SITTING) currentItem.clearDialogBox()
    }

    // set selected item and set up new dialog
    playerSelector.selectedItem = selectionItem
    selectionItem.onOverlapDialog()
  }

  private addObjectFromTiled(
    group: Phaser.Physics.Arcade.StaticGroup,
    object: Phaser.Types.Tilemaps.TiledObject,
    key: string,
    tilesetName: string
  ) {
    const actualX = object.x! + object.width! * 0.5
    const actualY = object.y! - object.height! * 0.5
    const obj = group
      .get(actualX, actualY, key, object.gid! - this.map.getTileset(tilesetName).firstgid)
      .setDepth(actualY)
    return obj
  }

  private addGroupFromTiled(
    objectLayerName: string,
    key: string,
    tilesetName: string,
    collidable: boolean
  ) {
    const group = this.physics.add.staticGroup()
    const objectLayer = this.map.getObjectLayer(objectLayerName)
    objectLayer.objects.forEach((object) => {
      // the boardroom table lives across these layers; the fire goes there now
      if (inFireRoom(object.x!, object.y!)) return
      const actualX = object.x! + object.width! * 0.5
      const actualY = object.y! - object.height! * 0.5
      group
        .get(actualX, actualY, key, object.gid! - this.map.getTileset(tilesetName).firstgid)
        .setDepth(actualY)
    })
    if (this.myPlayer && collidable)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], group)
  }

  // function to add new player to the otherPlayer group
  private handlePlayerJoined(newPlayer: IPlayer, id: string) {
    // guard against adding the same player twice and orphaning the first sprite
    if (this.otherPlayerMap.has(id)) return
    const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'adam', id, newPlayer.name)
    this.otherPlayers.add(otherPlayer)
    this.otherPlayerMap.set(id, otherPlayer)
  }

  // function to remove the player who left from the otherPlayer group
  private handlePlayerLeft(id: string) {
    if (this.otherPlayerMap.has(id)) {
      const otherPlayer = this.otherPlayerMap.get(id)
      if (!otherPlayer) return
      this.otherPlayers.remove(otherPlayer, true, true)
      this.otherPlayerMap.delete(id)
    }
  }

  private handleMyPlayerReady() {
    this.myPlayer.readyToConnect = true
  }

  private handleMyVideoConnected() {
    this.myPlayer.videoConnected = true
  }

  // function to update target position upon receiving player updates
  private handlePlayerUpdated(field: string, value: number | string, id: string) {
    const otherPlayer = this.otherPlayerMap.get(id)
    otherPlayer?.updateOtherPlayer(field, value)
  }

  private handlePlayersOverlap(myPlayer, otherPlayer) {
    otherPlayer.makeCall(myPlayer, this.network?.webRTC)
  }

  private handleItemUserAdded(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.addCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      const whiteboard = this.whiteboardMap.get(itemId)
      whiteboard?.addCurrentUser(playerId)
    }
  }

  private handleItemUserRemoved(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.removeCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      const whiteboard = this.whiteboardMap.get(itemId)
      whiteboard?.removeCurrentUser(playerId)
    }
  }

  private handleChatMessageAdded(playerId: string, content: string) {
    const otherPlayer = this.otherPlayerMap.get(playerId)
    otherPlayer?.updateDialogBubble(content)
  }

  update(t: number, dt: number) {
    if (this.myPlayer && this.network) {
      this.playerSelector.update(this.myPlayer, this.cursors)
      this.myPlayer.update(this.playerSelector, this.cursors, this.keyE, this.keyR, this.network)
    }
  }
}
