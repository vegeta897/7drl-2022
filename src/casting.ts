import { CastTargetSprite, PlayerEntity, TILE_SIZE } from './'
import { addVector2, Down, getDistance, GridZero, Left, Right, Up, Vector2, vectorsAreParallel } from './vector2'
import { World } from './ecs'
import { Sprite, Texture } from 'pixi.js'
import { SpritesByEID } from './sprites'
import { WorldSprites } from './pixi'
import {
  Bait,
  changeEntGrid,
  deleteEntGrid,
  DisplayObject,
  getEntGrid,
  GridPosition,
  setEntGrid,
} from './ecs/components'
import { processInput, setPlayerState } from './ecs/input_systems'
import { addComponent, addEntity, entityExists, removeEntity } from 'bitecs'
import { Level, Tile } from './level'
import { Log } from './hud'

export const CastVector = { x: 0, y: 0 }

export let BaitEntity: number | null = null

export function beginCast() {
  CastVector.x = 0
  CastVector.y = 0
  CastTargetSprite.x = 0
  CastTargetSprite.y = 0
  CastTargetSprite.visible = true
  setPlayerState('casting')
}

export function moveCastTarget(move: Vector2) {
  const castTo = addVector2(CastVector, move)
  const playerGrid = getEntGrid(PlayerEntity)
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
}

export function confirmCast() {
  setPlayerState('idle')
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
    processInput()
    setPlayerState('angling')
  }
}

export function angleBait(move: Vector2) {
  const playerGrid = getEntGrid(PlayerEntity)
  if (!entityExists(World, BaitEntity!)) {
    BaitEntity = null
    setPlayerState('idle')
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
          setPlayerState('idle')
          Log.unshift('You reeled in the bait')
        } else {
          changeEntGrid(BaitEntity!, addVector2(playerGrid, CastVector))
        }
        processInput()
        break
      }
    }
  }
}

export function cutLine() {
  // Should cutting line take a turn?
  BaitEntity = null
  setPlayerState('idle')
}
