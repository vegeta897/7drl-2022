import { GridMap } from './map'
import { FOV } from 'rot-js'
import { DEBUG_VISIBILITY, Level } from './level'
import { getEntGrid, InFOV, Spotting } from './ecs/components'
import { PlayerEntity } from './'
import { sineOut } from '@gamestdio/easing'
import { Sprite } from 'pixi.js'
import { clamp } from 'rot-js/lib/util'
import { SpritesByEID } from './sprites'
import { addComponent, entityExists, hasComponent, removeComponent } from 'bitecs'
import { World } from './ecs'

export const FOV_RADIUS = 12
const FOG_VISIBILITY = 0.7 // Max visibility of previously seen tiles
const TWEEN_TIME = 120 // Milliseconds

let needTileUpdate = true
let needEntityUpdate = true
export const triggerTileUpdate = () => (needTileUpdate = true)
export const triggerEntityUpdate = () => (needEntityUpdate = true)

type VisibilityMap = GridMap<[directness: number, radius: number]>

let prevVisibilityMap: VisibilityMap = new GridMap()

export function updateVisibility() {
  if (DEBUG_VISIBILITY) return
  if (!needTileUpdate && !needEntityUpdate) return
  const newVisibilityMap: VisibilityMap = needTileUpdate ? new GridMap() : prevVisibilityMap
  if (needTileUpdate) {
    const fov = new FOV.PreciseShadowcasting((x, y) => Level.get({ x, y }).seeThrough)
    const playerGrid = getEntGrid(PlayerEntity)
    fov.compute(playerGrid.x, playerGrid.y, FOV_RADIUS, (x, y, radius, directness) => {
      const prevVisibility = prevVisibilityMap.get({ x, y })
      newVisibilityMap.set({ x, y }, [
        Math.max(getEasedVisibility(directness, radius), prevVisibility ? prevVisibility[0] : 0),
        radius,
      ])
    })
    // Update static tiles
    Level.data.forEach((tile) => {
      if (!tile.sprite) return
      if (tile.ignoreFOV) return
      if (!prevVisibilityMap.has(tile) && !newVisibilityMap.has(tile)) return
      const prevVisibility = prevVisibilityMap.get(tile)
      const newVisibility = newVisibilityMap.get(tile)
      if (prevVisibility && !newVisibility) {
        // Previously visible tile no longer visible
        const alpha = clamp(tile.revealed, prevVisibility[0], FOG_VISIBILITY)
        tweeningSprites.set(tile.sprite, [TWEEN_TIME, tile.sprite.alpha, alpha])
      } else if (newVisibility) {
        tile.revealed = Math.max(tile.revealed, newVisibility[0])
        const alpha = tile.revealed
        if (tile.sprite.alpha !== alpha) tweeningSprites.set(tile.sprite, [TWEEN_TIME, tile.sprite.alpha, alpha])
      }
    })
  }
  if (needTileUpdate || needEntityUpdate) {
    // Update non-player entities
    SpritesByEID.forEach((sprite, eid) => {
      if (eid === PlayerEntity) return
      if (!entityExists(World, eid)) return
      const entityGrid = getEntGrid(eid)
      const visibility = newVisibilityMap.get(entityGrid)
      let alpha: number
      if (!visibility) {
        removeComponent(World, InFOV, eid)
        alpha = 0
      } else {
        addComponent(World, InFOV, eid)
        if (hasComponent(World, Spotting, eid)) {
          alpha = Spotting.current[eid] >= 1 ? 1 : 0
        } else {
          alpha = 1
        }
      }
      if (sprite.alpha !== alpha) tweeningSprites.set(sprite, [TWEEN_TIME, sprite.alpha, alpha])
    })
  }
  prevVisibilityMap = newVisibilityMap
  needEntityUpdate = false
  needTileUpdate = false
  tweeningFOV = true
}

function getEasedVisibility(directness: number, radius: number): number {
  return directness * sineOut((FOV_RADIUS - radius) / FOV_RADIUS)
}

let tweeningFOV = false
const tweeningSprites: Map<Sprite, [timeLeft: number, fromAlpha: number, toAlpha: number]> = new Map()

export function tweenVisibility(delta: number) {
  if (!tweeningFOV) return
  tweeningSprites.forEach((tween, sprite) => {
    let [timeLeft, fromAlpha, toAlpha] = tween
    timeLeft = Math.max(0, timeLeft - delta)
    if (timeLeft <= 0) {
      sprite.alpha = toAlpha
      tweeningSprites.delete(sprite)
    } else {
      sprite.alpha = toAlpha - (toAlpha - fromAlpha) * (timeLeft / TWEEN_TIME)
    }
    tween[0] = timeLeft
  })
  tweeningFOV = tweeningSprites.size > 0
}

export function resetFOV() {
  prevVisibilityMap = new GridMap()
}
