import { GridMap } from './map'
import { FOV } from 'rot-js'
import { Level } from './level'
import { getEntGrid } from './ecs/components'
import { PlayerEntity } from './index'
import { sineOut } from '@gamestdio/easing'
import { Sprite } from 'pixi.js'

const FOV_RADIUS = 12
const FOG_VISIBILITY = 0.3 // Max visibility of previously seen tiles
const TWEEN_TIME = 200 // Milliseconds

let needFOVUpdate = true
export const triggerFOVUpdate = () => (needFOVUpdate = true)

type VisibilityMap = GridMap<[visibility: number, radius: number]>

let prevVisibilityMap: VisibilityMap = new GridMap()

export function updateVisibility() {
  if (!needFOVUpdate) return
  needFOVUpdate = false

  const newVisibilityMap: VisibilityMap = new GridMap()
  const fov = new FOV.PreciseShadowcasting((x, y) => Level.get({ x, y }).seeThrough)
  const playerGrid = getEntGrid(PlayerEntity)
  fov.compute(playerGrid.x, playerGrid.y, FOV_RADIUS, (x, y, radius, visibility) => {
    const prevVisibility = prevVisibilityMap.get({ x, y })
    newVisibilityMap.set({ x, y }, [
      Math.max(getEasedVisibility(visibility, radius), prevVisibility ? prevVisibility[0] : 0),
      radius,
    ])
  })
  Level.data.forEach((tile) => {
    if (!tile.sprite) return
    if (tile.ignoreFOV) return
    if (prevVisibilityMap.has(tile) && !newVisibilityMap.has(tile)) return
    const prevVisibility = prevVisibilityMap.get(tile)
    const newVisibility = newVisibilityMap.get(tile)
    if (prevVisibility && !newVisibility) {
      // Previously visible tile no longer visible
      const alpha = Math.min(FOG_VISIBILITY, Math.max(prevVisibility[0], tile.revealed))
      if (tile.sprite.alpha !== alpha) tweeningSprites.set(tile.sprite, alpha)
    } else if (newVisibility) {
      tile.revealed = Math.max(tile.revealed, newVisibility[0])
      const alpha = tile.revealed
      if (tile.sprite.alpha !== alpha) tweeningSprites.set(tile.sprite, alpha)
    }
  })
  prevVisibilityMap = newVisibilityMap
  tweeningFOV = true
}

function getEasedVisibility(visibility: number, radius: number): number {
  return visibility * sineOut((FOV_RADIUS - radius) / FOV_RADIUS)
}

let tweeningFOV = false
const tweeningSprites: Map<Sprite, number> = new Map()

export function tweenVisibility(delta: number) {
  if (!tweeningFOV) return
  tweeningSprites.forEach((targetAlpha, sprite) => {
    sprite.alpha = targetAlpha
  })
  tweeningFOV = false
}
