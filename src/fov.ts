import { GridMap } from './map'
import { FOV } from 'rot-js'
import { ALL_VISIBLE, Level } from './level'
import { CalculateFOV, getEntGrid, Spotting } from './ecs/components'
import { PlayerEntity } from './'
import { cubicOut } from '@gamestdio/easing'
import { Sprite } from 'pixi.js'
import { clamp } from 'rot-js/lib/util'
import { SpritesByEID } from './sprites'
import { defineQuery, hasComponent, Query } from 'bitecs'
import { World } from './ecs'

export const FOV_RADIUS = 10
const FOG_VISIBILITY = 0.5 // Max visibility of previously seen tiles
const TWEEN_TIME = 150 // Milliseconds

// const desaturated = new filters.ColorMatrixFilter() // Too expensive on CPU, try pre-made desaturated textures
// desaturated.desaturate()
// desaturated.alpha = 0.3

let needTileUpdate = true
export const triggerTileUpdate = () => (needTileUpdate = true)

type Visibility = [directness: number, radius: number]
export let VisibilityMap: GridMap<Visibility> = new GridMap()
export const RecalcEntities: Set<number> = new Set()

const getEasedVisibility = ([d, r]: Visibility): number => d * cubicOut((FOV_RADIUS - r) / FOV_RADIUS)

let fovEntities: Query // This file is loaded before component registration

export function updateVisibility() {
  if (ALL_VISIBLE) return
  if (!needTileUpdate) return
  const newVisibilityMap: GridMap<Visibility> = new GridMap()
  const playerGrid = getEntGrid(PlayerEntity)
  const fov = new FOV.PreciseShadowcasting(
    (x, y) => Level.get({ x, y }).seeThrough || (playerGrid.x === x && playerGrid.y === y)
  )
  fov.compute(playerGrid.x, playerGrid.y, FOV_RADIUS, (x, y, radius, directness) => {
    const prevVisibility = VisibilityMap.get({ x, y })
    newVisibilityMap.set({ x, y }, [
      Math.max(getEasedVisibility([directness, radius]), prevVisibility ? prevVisibility[0] : 0),
      radius,
    ])
  })
  // Update static tiles
  Level.data.forEach((tile) => {
    if (!tile.sprite) return
    if (tile.ignoreFOV) return
    if (!VisibilityMap.has(tile) && !newVisibilityMap.has(tile)) return
    const prevVisibility = VisibilityMap.get(tile)
    const newVisibility = newVisibilityMap.get(tile)
    if (prevVisibility && !newVisibility) {
      // Previously visible tile no longer visible
      const alpha = clamp(tile.revealed, prevVisibility[0], FOG_VISIBILITY)
      // tile.sprite.filters = [desaturated] // Too expensive on CPU
      tweeningSprites.set(tile.sprite, [TWEEN_TIME, tile.sprite.alpha, alpha])
    } else if (newVisibility) {
      // tile.sprite.filters = null
      tile.revealed = Math.max(tile.revealed, newVisibility[0])
      const alpha = tile.revealed
      if (tile.sprite.alpha !== alpha) tweeningSprites.set(tile.sprite, [TWEEN_TIME, tile.sprite.alpha, alpha])
    }
  })
  VisibilityMap = newVisibilityMap
  fovEntities = fovEntities || defineQuery([CalculateFOV])
  for (const eid of fovEntities(World)) {
    RecalcEntities.add(eid)
  }
  needTileUpdate = false
}

export function updateEntityVisibility() {
  if (ALL_VISIBLE) return
  for (const eid of RecalcEntities) {
    const sprite = SpritesByEID[eid]
    const entityGrid = getEntGrid(eid)
    const visibility = VisibilityMap.get(entityGrid)
    let alpha: number
    if (!visibility) {
      CalculateFOV.distance[eid] = -1
      alpha = 0
    } else {
      CalculateFOV.distance[eid] = visibility[1]
      if (hasComponent(World, Spotting, eid)) {
        alpha = Spotting.current[eid] >= 1 ? 1 : 0
      } else {
        alpha = 1
      }
    }
    if (sprite.alpha !== alpha) tweeningSprites.set(sprite, [TWEEN_TIME, sprite.alpha, alpha])
  }
  RecalcEntities.clear()
}

const tweeningSprites: Map<Sprite, [timeLeft: number, fromAlpha: number, toAlpha: number]> = new Map()

export function tweenVisibility(delta: number) {
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
}

export function resetFOV() {
  VisibilityMap = new GridMap()
}
