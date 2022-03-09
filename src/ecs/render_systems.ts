import { defineQuery, enterQuery, exitQuery, System } from 'bitecs'
import { GameState, PlayerEntity, PlayerSprite, setGameState, TILE_SIZE } from '../'
import { PixiViewport } from '../pixi'
import { Util } from 'rot-js'
import { DisplayObject, GridPosition } from './components'
import { SpritesByEID } from '../sprites'
import { tweenVisibility } from '../fov'
import { Ticker } from 'pixi.js'
import { cubicOut } from '@gamestdio/easing'
import { drawHud } from '../hud'

const PADDING = 1.25 / 3 // Portion of screen to pad
const PAD_X = Math.floor(PixiViewport.screenWidthInWorldPixels / 2 - PixiViewport.screenWidthInWorldPixels * PADDING)
const PAD_Y = Math.floor(PixiViewport.screenHeightInWorldPixels / 2 - PixiViewport.screenHeightInWorldPixels * PADDING)

const spriteQuery = defineQuery([DisplayObject, GridPosition])
const enteredSpriteQuery = enterQuery(spriteQuery)
const exitedSpriteQuery = exitQuery(spriteQuery)

export const spriteAddSystem: System = (world) => {
  for (const eid of enteredSpriteQuery(world)) {
    SpritesByEID[eid].x = GridPosition.x[eid] * TILE_SIZE
    SpritesByEID[eid].y = GridPosition.y[eid] * TILE_SIZE
    if (eid === PlayerEntity) PixiViewport.moveCenter(PlayerSprite)
  }
  return world
}

export const spriteRemoveSystem: System = (world) => {
  for (const eid of exitedSpriteQuery(world)) {
    SpritesByEID[eid].destroy()
    delete SpritesByEID[eid]
  }
  return world
}

export const fovSystem: System = (world) => {
  tweenVisibility(Ticker.shared.deltaMS)
  return world
}

export const cameraSystem: System = (world) => {
  if (PlayerSprite.destroyed) return world
  const centerX = PlayerSprite.x + TILE_SIZE / 2
  const centerY = PlayerSprite.y + TILE_SIZE / 2
  const camOffsetX = centerX - PixiViewport.center.x
  const camOffsetY = centerY - PixiViewport.center.y
  if (Math.abs(camOffsetX) > PAD_X || Math.abs(camOffsetY) > PAD_Y) {
    PixiViewport.moveCenter({
      x: Util.clamp(PixiViewport.center.x, centerX - PAD_X, centerX + PAD_X),
      y: Util.clamp(PixiViewport.center.y, centerY - PAD_Y, centerY + PAD_Y),
    })
  }
  return world
}

let fadeProgress = 0
export const fadeSystem: System = (world) => {
  if (GameState === 'Losing') {
    fadeProgress = Math.min(1, fadeProgress + Ticker.shared.deltaMS / 3500)
    PixiViewport.alpha = cubicOut(1 - fadeProgress)
    if (fadeProgress === 1) {
      fadeProgress = 0
      setGameState('Lost')
      drawHud()
    }
  }
  return world
}
