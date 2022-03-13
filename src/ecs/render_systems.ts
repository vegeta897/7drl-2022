import { defineQuery, exitQuery, System } from 'bitecs'
import { GameState, PlayerSprite, setGameState, TILE_SIZE } from '../'
import { PixiViewport } from '../pixi'
import { Util } from 'rot-js'
import { DisplayObject, GridPosition } from './components'
import { SpritesByEID } from '../sprites'
import { tweenVisibility } from '../fov'
import { Ticker } from 'pixi.js'
import { cubicOut } from '@gamestdio/easing'
import { drawHud } from '../hud'

const spriteQuery = defineQuery([DisplayObject, GridPosition])
const exitedSpriteQuery = exitQuery(spriteQuery)

export const spriteRemoveSystem: System = (world) => {
  for (const eid of exitedSpriteQuery(world)) {
    if (!SpritesByEID[eid].destroyed) SpritesByEID[eid].destroy()
    delete SpritesByEID[eid]
  }
  return world
}

export const fovSystem: System = (world) => {
  tweenVisibility(Ticker.shared.deltaMS)
  return world
}

const PAD = 32

export const cameraSystem: System = (world) => {
  if (PlayerSprite.destroyed) return world
  const centerX = Math.floor(PlayerSprite.x + TILE_SIZE / 2)
  const centerY = Math.floor(PlayerSprite.y + TILE_SIZE / 2)
  const camOffsetX = centerX - PixiViewport.center.x
  const camOffsetY = centerY - PixiViewport.center.y
  if (Math.abs(camOffsetX) > PAD || Math.abs(camOffsetY) > PAD) {
    PixiViewport.moveCenter({
      x: Util.clamp(PixiViewport.center.x, centerX - PAD, centerX + PAD),
      y: Util.clamp(PixiViewport.center.y, centerY - PAD, centerY + PAD),
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
