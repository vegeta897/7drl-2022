import { addComponent, addEntity, System } from 'bitecs'
import { onInput, World } from './'
import { CastTargetSprite, PlayerEntity, TILE_SIZE } from '../'
import { Bait, DisplayObject, GridPosition, MoveAction } from './components'
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
import { drawHud } from '../hud'
import { Sprite, Texture } from 'pixi.js'
import { SpritesByEID } from '../sprites'
import { WorldSprites } from '../pixi'
import { EntityMap, Level, Tile, TileMap } from '../level'

export const waitForInput = () => (WaitingForInput = true)
export let WaitingForInput = true

// TODO: Should a button pressed during animation be queued?

type PlayerStates = 'idle' | 'casting' | 'angling'
export let PlayerState: PlayerStates = 'idle'

export const CastVector = { x: 0, y: 0 }

export const inputSystem: System = (world) => {
  const button = getButton()
  if (button === null) return world
  const previousState = PlayerState
  const playerGrid = { x: GridPosition.x[PlayerEntity], y: GridPosition.y[PlayerEntity] }
  if (button === 'cast') {
    if (previousState === 'idle') {
      CastVector.x = 0
      CastVector.y = 0
      CastTargetSprite.x = 0
      CastTargetSprite.y = 0
      CastTargetSprite.visible = true
      PlayerState = 'casting'
    }
    if (previousState === 'casting') {
      PlayerState = 'idle'
      CastTargetSprite.visible = false
      if (getDistance(CastVector) > 0) {
        const bait = addEntity(World)
        const baitSprite = new Sprite(Texture.from('bait'))
        SpritesByEID[bait] = baitSprite
        WorldSprites.addChild(baitSprite)
        addComponent(World, DisplayObject, bait)
        addComponent(World, GridPosition, bait)
        addComponent(World, Bait, bait)
        GridPosition.x[bait] = playerGrid.x + CastVector.x
        GridPosition.y[bait] = playerGrid.y + CastVector.y
        EntityMap.set(TileMap.keyFromXY(GridPosition.x[bait], GridPosition.y[bait]), bait)
        WaitingForInput = false
        PlayerState = 'angling'
      }
    }
    if (previousState === 'angling') {
      // TODO: Cut line
      // Should cutting line take a turn?
      PlayerState = 'idle'
    }
  } else if (button === 'wait') {
    WaitingForInput = false
  } else if (button === 'confirm') {
    // TODO: Confirm bait placement
  } else if (button === 'exit') {
    PlayerState = 'idle'
    CastTargetSprite.visible = false
  } else {
    const move = DirectionGrids[DirectionNames.indexOf(button)]
    if (previousState === 'casting') {
      const castTo = addVector2(CastVector, move)
      for (const mod of [GridZero, Up, Down, Left, Right]) {
        if (vectorsAreParallel(mod, move)) continue
        const moddedCastTo = addVector2(castTo, mod)
        const moddedDistance = getDistance(moddedCastTo)
        const moddedAbsolute = addVector2(playerGrid, moddedCastTo)
        const tile = Level.get(TileMap.keyFromXY(moddedAbsolute.x, moddedAbsolute.y))
        if (moddedDistance <= 4 && tile !== Tile.Wall) {
          CastVector.x = moddedCastTo.x
          CastVector.y = moddedCastTo.y
          CastTargetSprite.x = CastVector.x * TILE_SIZE
          CastTargetSprite.y = CastVector.y * TILE_SIZE
          break
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
let currentKey: null | GameKey = null

const isGameKey = (key: string): key is GameKey => gameKeys.includes(key as GameKey)

window.addEventListener('keydown', async (e) => {
  if (e.repeat) return
  if (!isGameKey(e.code)) return
  e.preventDefault()
  Keys.add(e.code)
  currentKey = e.code
  if (WaitingForInput) await onInput()
})
window.addEventListener('keyup', (e) => {
  if (!isGameKey(e.code)) return
  Keys.delete(e.code)
  currentKey = null
})

type Button = typeof DirectionNames[number] | 'wait' | 'cast' | 'exit' | 'confirm' | null
function getButton(): Button {
  switch (currentKey) {
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
