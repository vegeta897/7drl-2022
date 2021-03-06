import { PlayerEntity, PlayerSprite, TILE_SIZE } from './'
import { addVector2, Down, getDistance, GridZero, Left, Right, Up, Vector2, vectorsAreParallel } from './vector2'
import { World } from './ecs'
import { Graphics, Sprite } from 'pixi.js'
import { addSprite, getTexture } from './sprites'
import { WorldSprites } from './pixi'
import {
  Bait,
  CalculateFOV,
  changeEntGrid,
  deleteEntGrid,
  DisplayObject,
  getEntGrid,
  GridPosition,
  MoveAction,
  NonPlayer,
  OnTileType,
  Scent,
  setEntGrid,
} from './ecs/components'
import { processInput, setPlayerState } from './ecs/input_systems'
import { addComponent, addEntity, entityExists, removeEntity } from 'bitecs'
import { EntityMap, Level } from './level'
import { addScore, Colors, logMessage } from './hud'
import { ActiveLures, Lure, Supplies } from './inventory'
import { activateSecondSight, deactivateSecondSight, triggerTileUpdate } from './fov'
import { isWet } from './map'

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
  if (Supplies.bait === 0) {
    logMessage('You need bait to cast', Colors.Warning)
    return
  }
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
    if (getDistance(moddedCastTo) <= Supplies.lineLength && !Level.get(addVector2(playerGrid, moddedCastTo)).solid) {
      CastVector.x = moddedCastTo.x
      CastVector.y = moddedCastTo.y
      castTargetSprite.x = CastVector.x * TILE_SIZE
      castTargetSprite.y = CastVector.y * TILE_SIZE
      break
    }
  }
}

export function confirmCast() {
  const castGrid = addVector2(getEntGrid(PlayerEntity), CastVector)
  const distance = getDistance(CastVector)
  if (distance === 0) {
    setPlayerState('Idle')
    castTargetSprite.visible = false
    return
  }
  if (EntityMap.has(castGrid)) {
    logMessage("You can't cast there")
    return
  }
  let baitNeeded = 1
  if (ActiveLures.has(Lure.Telecasting)) {
    baitNeeded = distance
    if (baitNeeded > Supplies.bait) {
      logMessage(`You need ${baitNeeded} bait to telecast there`, Colors.Spooky)
      return
    }
    addComponent(World, MoveAction, PlayerEntity)
    MoveAction.x[PlayerEntity] = CastVector.x
    MoveAction.y[PlayerEntity] = CastVector.y
    MoveAction.noclip[PlayerEntity] = 1
    logMessage(`Telecast used ${baitNeeded} bait`, Colors.Spooky)
    setPlayerState('Idle')
  } else {
    PlayerSprite.texture = getTexture(isWet(OnTileType.current[PlayerEntity]) ? 'playerCastSwim' : 'playerCast')
    BaitEntity = spawnBait(castGrid)
    if (isWet(Level.get(castGrid).type) && ActiveLures.has(Lure.MagicSponge)) {
      // Soak it up!
      Level.dryTile(castGrid)
      Bait.waterVolume[BaitEntity] = 1
      triggerTileUpdate()
    }
    if (ActiveLures.has(Lure.SecondSight)) activateSecondSight()
    setPlayerState('Angling')
    drawFishingLine()
  }
  Supplies.bait -= baitNeeded
  castTargetSprite.visible = false
  processInput()
}

export function spawnBait(grid: Vector2): number {
  const bait = addEntity(World)
  addSprite(bait, new Sprite(getTexture('bait')), WorldSprites)
  addComponent(World, NonPlayer, bait)
  addComponent(World, Bait, bait)
  addComponent(World, DisplayObject, bait)
  addComponent(World, Scent, bait)
  Scent.range[bait] = 5
  addComponent(World, GridPosition, bait)
  setEntGrid(bait, grid)
  addComponent(World, OnTileType, bait)
  addComponent(World, CalculateFOV, bait)
  return bait
}

export function cancelCast() {
  castTargetSprite.visible = false
  setPlayerState('Idle')
}

export function angleBait(move: Vector2) {
  const playerGrid = getEntGrid(PlayerEntity)
  if (!entityExists(World, BaitEntity!)) {
    console.warn('this code should not be reachable')
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
      if (moddedDistance > maxAngleDistance) continue
      if (moddedDistance === 0) {
        if (Bait.waterVolume[BaitEntity!] > 0) Level.floodTile(playerGrid, Bait.waterVolume[BaitEntity!])
        deleteEntGrid(BaitEntity!)
        removeEntity(World, BaitEntity!)
        BaitEntity = null
        if (ActiveLures.has(Lure.SecondSight)) deactivateSecondSight()
        setPlayerState('Idle')
        Supplies.bait++
        logMessage('You reeled in the bait', Colors.Dim)
        fishingLineGraphics.cacheAsBitmap = false
        fishingLineGraphics.clear()
      } else {
        if (EntityMap.get(moddedAbsolute)) continue
        if (Level.get(moddedAbsolute).solid) {
          if (!ActiveLures.has(Lure.WreckingBall)) continue
          if (Supplies.bait === 0) continue
          // Knock it down!
          Level.mineTile(moddedAbsolute)
          triggerTileUpdate()
          addScore(10)
          Supplies.bait--
          logMessage('Wrecking Ball used 1 bait', Colors.Danger)
        }
        if (isWet(Level.get(moddedAbsolute).type) && ActiveLures.has(Lure.MagicSponge)) {
          // Soak it up!
          Level.dryTile(moddedAbsolute)
          Bait.waterVolume[BaitEntity!]++
          triggerTileUpdate()
        }
        if (ActiveLures.has(Lure.SecondSight)) triggerTileUpdate()
        CastVector.x = moddedCastTo.x
        CastVector.y = moddedCastTo.y
        drawFishingLine()
        const moveTo = addVector2(playerGrid, CastVector)
        changeEntGrid(BaitEntity!, moveTo)
      }
      processInput()
      break
    }
  }
}

export function drawFishingLine() {
  fishingLineGraphics.cacheAsBitmap = false
  fishingLineGraphics.clear()
  fishingLineGraphics.lineStyle(1, 0xa1d1d4)
  fishingLineGraphics.moveTo(12.5, isWet(OnTileType.current[PlayerEntity]) ? 4 : 0)
  fishingLineGraphics.bezierCurveTo(
    12.5 + (CastVector.x / 3) * TILE_SIZE,
    (isWet(OnTileType.current[PlayerEntity]) ? 4 : 0) + TILE_SIZE / 2 + Math.max(0, CastVector.y / 2 + 1) * TILE_SIZE,
    TILE_SIZE / 2 + CastVector.x * TILE_SIZE,
    (CastVector.y + 0.5) * TILE_SIZE,
    (CastVector.x + 0.5) * TILE_SIZE,
    (CastVector.y + 0.5) * TILE_SIZE - 3
  )
  fishingLineGraphics.cacheAsBitmap = true
}

export function cutLine() {
  BaitEntity = null
  if (ActiveLures.has(Lure.SecondSight)) deactivateSecondSight(true)
  fishingLineGraphics.cacheAsBitmap = false
  fishingLineGraphics.clear()
  setPlayerState('Idle')
  PlayerSprite.texture = getTexture(isWet(OnTileType.current[PlayerEntity]) ? 'playerSwim' : 'player')
}

export function resetCasting() {
  CastVector.x = 0
  CastVector.y = 0
  BaitEntity = null
  castTargetSprite.destroy()
  fishingLineGraphics.cacheAsBitmap = false
  fishingLineGraphics.destroy()
}
