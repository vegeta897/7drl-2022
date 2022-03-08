import { addComponent, addEntity, entityExists, removeEntity, System } from 'bitecs'
import { onInput, World } from './'
import { CastTargetSprite, PlayerEntity, TILE_SIZE } from '../'
import {
  Bait,
  changeEntGrid,
  deleteEntGrid,
  DisplayObject,
  getEntGrid,
  GridPosition,
  MoveAction,
  setEntGrid,
} from './components'
import {
  addVector2,
  DirectionGrids,
  DirectionNames,
  Down,
  getDistance,
  GridZero,
  Left,
  Right,
  Up,
  vectorsAreParallel,
} from '../vector2'
import { drawHud, Log } from '../hud'
import { Sprite, Texture } from 'pixi.js'
import { SpritesByEID } from '../sprites'
import { WorldSprites } from '../pixi'
import { Level, Tile } from '../level'

export const waitForInput = () => (WaitingForInput = true)
export let WaitingForInput = true

// TODO: Should a button pressed during animation be queued?

type PlayerStates = 'idle' | 'casting' | 'angling'
export let PlayerState: PlayerStates = 'idle'

export const CastVector = { x: 0, y: 0 }
export let BaitEntity: number | null = null

function confirmCast() {
  PlayerState = 'idle'
  CastTargetSprite.visible = false
  if (getDistance(CastVector) > 0) {
    BaitEntity = addEntity(World)
    const baitSprite = new Sprite(Texture.from('bait'))
    SpritesByEID[BaitEntity] = baitSprite
    WorldSprites.addChild(baitSprite)
    addComponent(World, Bait, BaitEntity)
    addComponent(World, DisplayObject, BaitEntity)
    addComponent(World, GridPosition, BaitEntity)
    setEntGrid(BaitEntity, addVector2(getEntGrid(PlayerEntity), CastVector))
    WaitingForInput = false
    PlayerState = 'angling'
  }
}

export const inputSystem: System = (world) => {
  if (!button) return world
  const previousState = PlayerState
  if (button === 'cast') {
    if (previousState === 'idle') {
      CastVector.x = 0
      CastVector.y = 0
      CastTargetSprite.x = 0
      CastTargetSprite.y = 0
      CastTargetSprite.visible = true
      PlayerState = 'casting'
    }
    if (previousState === 'casting') confirmCast()
    if (previousState === 'angling') {
      // Should cutting line take a turn?
      BaitEntity = null
      PlayerState = 'idle'
    }
  } else if (button === 'wait') {
    WaitingForInput = false
  } else if (button === 'confirm') {
    if (previousState === 'casting') confirmCast()
  } else if (button === 'exit') {
    PlayerState = 'idle'
    CastTargetSprite.visible = false
  } else {
    const move = DirectionGrids[DirectionNames.indexOf(button)]
    const playerGrid = getEntGrid(PlayerEntity)
    if (previousState === 'casting') {
      const castTo = addVector2(CastVector, move)
      for (const mod of [GridZero, Up, Down, Left, Right]) {
        if (vectorsAreParallel(mod, move)) continue
        const moddedCastTo = addVector2(castTo, mod)
        if (getDistance(moddedCastTo) <= 4 && Level.get(addVector2(playerGrid, moddedCastTo)) !== Tile.Wall) {
          CastVector.x = moddedCastTo.x
          CastVector.y = moddedCastTo.y
          CastTargetSprite.x = CastVector.x * TILE_SIZE
          CastTargetSprite.y = CastVector.y * TILE_SIZE
          break
        }
      }
    } else if (previousState === 'angling') {
      if (!entityExists(World, BaitEntity!)) {
        BaitEntity = null
        PlayerState = 'idle'
      } else {
        const angleTo = addVector2(CastVector, move)
        const maxAngleDistance = getDistance(CastVector)
        for (const mod of [GridZero, Up, Down, Left, Right]) {
          if (vectorsAreParallel(mod, move)) continue
          const moddedCastTo = addVector2(angleTo, mod)
          const moddedDistance = getDistance(moddedCastTo)
          const moddedAbsolute = addVector2(playerGrid, moddedCastTo)
          if (moddedDistance <= maxAngleDistance && Level.get(moddedAbsolute) !== Tile.Wall) {
            CastVector.x = moddedCastTo.x
            CastVector.y = moddedCastTo.y
            if (moddedDistance === 0) {
              deleteEntGrid(BaitEntity!)
              removeEntity(World, BaitEntity!)
              BaitEntity = null
              PlayerState = 'idle'
              Log.unshift('You reeled in the bait')
            } else {
              changeEntGrid(BaitEntity!, addVector2(playerGrid, CastVector))
            }
            WaitingForInput = false
            break
          }
        }
      }
    } else {
      const boost = Keys.has('ControlLeft') || Keys.has('ControlRight')
      const noclip = Keys.has('ShiftLeft') || Keys.has('ShiftRight')
      addComponent(World, MoveAction, PlayerEntity)
      MoveAction.x[PlayerEntity] = move.x * (boost ? 10 : 1)
      MoveAction.y[PlayerEntity] = move.y * (boost ? 10 : 1)
      MoveAction.noclip[PlayerEntity] = noclip || boost ? 1 : 0
      WaitingForInput = false
    }
  }
  drawHud()
  return world
}

const Keys: Set<GameKey> = new Set()
let button: Button

const isGameKey = (key: string): key is GameKey => gameKeys.includes(key as GameKey)

window.addEventListener('keydown', async (e) => {
  if (e.repeat) return
  if (!isGameKey(e.code)) return
  e.preventDefault()
  Keys.add(e.code)
  button = getButton(e.code)
  if (button && WaitingForInput) await onInput()
})
window.addEventListener('keyup', (e) => {
  if (!isGameKey(e.code)) return
  Keys.delete(e.code)
})

type Button = typeof DirectionNames[number] | 'wait' | 'cast' | 'exit' | 'confirm' | null
function getButton(keyCode: GameKey): Button {
  switch (keyCode) {
    case 'KeyW':
    case 'KeyK':
    case 'ArrowUp':
      return 'up'
    case 'KeyS':
    case 'KeyJ':
    case 'ArrowDown':
      return 'down'
    case 'KeyA':
    case 'KeyH':
    case 'ArrowLeft':
      return 'left'
    case 'KeyD':
    case 'KeyL':
    case 'ArrowRight':
      return 'right'
    case 'KeyC':
      return 'cast'
    case 'Escape':
      return 'exit'
    case 'Space':
      return 'wait'
    case 'Enter':
      return 'confirm'
  }
  return null
}

type GameKey = typeof gameKeys[number]

const gameKeys = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyK',
  'KeyJ',
  'KeyH',
  'KeyL',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyC',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'Space',
  'Enter',
  'Escape',
] as const
