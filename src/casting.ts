import { PlayerEntity, PlayerSprite, TILE_SIZE } from './'
import { addVector2, Down, getDistance, GridZero, Left, Right, Up, Vector2, vectorsAreParallel } from './vector2'
import { World } from './ecs'
import { Graphics, Sprite } from 'pixi.js'
import { getTexture, SpritesByEID } from './sprites'
import { WorldSprites } from './pixi'
import {
  Bait,
  changeEntGrid,
  deleteEntGrid,
  DisplayObject,
  getEntGrid,
  GridPosition,
  Scent,
  setEntGrid,
} from './ecs/components'
import { processInput, setPlayerState } from './ecs/input_systems'
import { addComponent, addEntity, entityExists, removeEntity } from 'bitecs'
import { EntityMap, Level } from './level'
import { Log } from './hud'
import { Tile } from './map'

export const CastVector = { x: 0, y: 0 }
let castTargetSprite: Sprite
let fishingLineGraphics: Graphics

export let BaitEntity: number | null = null

export function initCasting() {
  castTargetSprite = new Sprite(getTexture('target'))
  PlayerSprite.addChild(castTargetSprite)
  castTargetSprite.visible = false
  fishingLineGraphics = new Graphics()
  PlayerSprite.addChild(fishingLineGraphics)
}

export function beginCast() {
  CastVector.x = 0
  CastVector.y = 0
  castTargetSprite.x = 0
  castTargetSprite.y = 0
  castTargetSprite.visible = true
  setPlayerState('Casting')
}

export function moveCastTarget(move: Vector2) {
  const castTo = addVector2(CastVector, move)
  const playerGrid = getEntGrid(PlayerEntity)
  for (const mod of [GridZero, Up, Down, Left, Right]) {
    if (vectorsAreParallel(mod, move)) continue
    const moddedCastTo = addVector2(castTo, mod)
    if (getDistance(moddedCastTo) <= 4 && Level.get(addVector2(playerGrid, moddedCastTo)).type !== Tile.Wall) {
      CastVector.x = moddedCastTo.x
      CastVector.y = moddedCastTo.y
      castTargetSprite.x = CastVector.x * TILE_SIZE
      castTargetSprite.y = CastVector.y * TILE_SIZE
      break
    }
  }
}

export function confirmCast() {
  setPlayerState('Idle')
  castTargetSprite.visible = false
  if (getDistance(CastVector) > 0) {
    BaitEntity = addEntity(World)
    const baitSprite = new Sprite(getTexture('bait'))
    SpritesByEID[BaitEntity] = baitSprite
    WorldSprites.addChild(baitSprite)
    addComponent(World, Bait, BaitEntity)
    addComponent(World, DisplayObject, BaitEntity)
    addComponent(World, Scent, BaitEntity)
    Scent.strength[BaitEntity] = 2
    addComponent(World, GridPosition, BaitEntity)
    setEntGrid(BaitEntity, addVector2(getEntGrid(PlayerEntity), CastVector))
    processInput()
    setPlayerState('Angling')
    drawFishingLine()
  }
}

export function cancelCast() {
  castTargetSprite.visible = false
}

export function angleBait(move: Vector2) {
  const playerGrid = getEntGrid(PlayerEntity)
  if (!entityExists(World, BaitEntity!)) {
    BaitEntity = null
    setPlayerState('Idle')
  } else {
    const angleTo = addVector2(CastVector, move)
    const maxAngleDistance = getDistance(CastVector)
    for (const mod of [GridZero, Up, Down, Left, Right]) {
      if (vectorsAreParallel(mod, move)) continue
      const moddedCastTo = addVector2(angleTo, mod)
      const moddedDistance = getDistance(moddedCastTo)
      const moddedAbsolute = addVector2(playerGrid, moddedCastTo)
      if (Level.get(moddedAbsolute).type === Tile.Wall) continue
      if (moddedDistance > maxAngleDistance) continue
      if (moddedDistance === 0) {
        deleteEntGrid(BaitEntity!)
        removeEntity(World, BaitEntity!)
        BaitEntity = null
        setPlayerState('Idle')
        Log.unshift('You reeled in the bait')
        fishingLineGraphics.clear()
      } else {
        if (EntityMap.get(moddedAbsolute)) continue
        CastVector.x = moddedCastTo.x
        CastVector.y = moddedCastTo.y
        drawFishingLine()
        changeEntGrid(BaitEntity!, addVector2(playerGrid, CastVector))
      }
      processInput()
      break
    }
  }
}

export function drawFishingLine() {
  fishingLineGraphics.cacheAsBitmap = false
  fishingLineGraphics.clear()
  fishingLineGraphics.lineStyle(1, 0xb3b9d1)
  fishingLineGraphics.moveTo(13, 0)
  fishingLineGraphics.bezierCurveTo(
    13 + (CastVector.x / 3) * TILE_SIZE,
    TILE_SIZE / 2 + Math.max(0, CastVector.y / 2 + 1) * TILE_SIZE,
    TILE_SIZE / 2 + CastVector.x * TILE_SIZE,
    (CastVector.y + 0.5) * TILE_SIZE,
    (CastVector.x + 0.5) * TILE_SIZE,
    (CastVector.y + 0.5) * TILE_SIZE
  )
  fishingLineGraphics.cacheAsBitmap = true
}

export function cutLine() {
  // Should cutting line take a turn?
  BaitEntity = null
  fishingLineGraphics.cacheAsBitmap = false
  fishingLineGraphics.clear()
  setPlayerState('Idle')
}

export function resetCasting() {
  CastVector.x = 0
  CastVector.y = 0
  BaitEntity = null
  castTargetSprite.destroy()
  fishingLineGraphics.cacheAsBitmap = false
  fishingLineGraphics.destroy()
}
