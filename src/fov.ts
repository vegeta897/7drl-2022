import { GridMap } from './map'
import { FOV } from 'rot-js'
import { Level } from './level'
import { getEntGrid } from './ecs/components'
import { PlayerEntity } from './index'
import { sineOut } from '@gamestdio/easing'
import { filters, Sprite } from 'pixi.js'
import { clamp } from 'rot-js/lib/util'
import { SpritesByEID } from './sprites'
import { ColorMatrixFilter } from '@pixi/filter-color-matrix'

const FOV_RADIUS = 12
const FOG_VISIBILITY = 0.7 // Max visibility of previously seen tiles
const TWEEN_TIME = 120 // Milliseconds

let needFOVUpdate = true
export const triggerFOVUpdate = () => (needFOVUpdate = true)

const greyLevels = 8
const greyFilterLevels: ColorMatrixFilter[] = []
for (let i = 1; i <= greyLevels; i++) {
  const filter = new filters.ColorMatrixFilter()
  filter.desaturate()
  filter.alpha = (i / greyLevels) * 0.5
  greyFilterLevels.push(filter)
}
const greyestFilter = greyFilterLevels[greyLevels - 1]

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
      if (tile.sprite.alpha !== alpha)
        tweeningSprites.set(tile.sprite, [TWEEN_TIME, tile.sprite.alpha, alpha, true, false])
    } else if (newVisibility) {
      tile.sprite.filters = []
      tile.revealed = Math.max(tile.revealed, newVisibility[0])
      const alpha = tile.revealed
      if (tile.sprite.alpha !== alpha)
        tweeningSprites.set(tile.sprite, [TWEEN_TIME, tile.sprite.alpha, alpha, !!prevVisibility, true])
    }
  })
  // Update non-player entities
  // TODO: Need to run this for any moved entities, not just player
  SpritesByEID.forEach((sprite, eid) => {
    if (eid === PlayerEntity) return
    const entityGrid = getEntGrid(eid)
    const previousVisibility = prevVisibilityMap.get(entityGrid)
    const visible = newVisibilityMap.has(entityGrid)
    const alpha = previousVisibility ? previousVisibility[0] : 0
    if (alpha !== sprite.alpha)
      tweeningSprites.set(sprite, [TWEEN_TIME, sprite.alpha, alpha, !!previousVisibility, visible])
  })
  prevVisibilityMap = newVisibilityMap
  tweeningFOV = true
}

function getEasedVisibility(visibility: number, radius: number): number {
  return visibility * sineOut((FOV_RADIUS - radius) / FOV_RADIUS)
}

let tweeningFOV = false
const tweeningSprites: Map<
  Sprite,
  [timeLeft: number, fromAlpha: number, toAlpha: number, wasVisible: boolean, nowVisible: boolean]
> = new Map()

export function tweenVisibility(delta: number) {
  if (!tweeningFOV) return
  tweeningSprites.forEach((tween, sprite) => {
    let [timeLeft, fromAlpha, toAlpha, wasVisible, nowVisible] = tween
    timeLeft = Math.max(0, timeLeft - delta)
    if (timeLeft <= 0) {
      sprite.alpha = toAlpha
      if (nowVisible) sprite.filters = []
      else sprite.filters = [greyestFilter]
      tweeningSprites.delete(sprite)
    } else {
      const percentLeft = timeLeft / TWEEN_TIME
      sprite.alpha = toAlpha - (toAlpha - fromAlpha) * percentLeft
      if (!wasVisible && nowVisible) {
        if (timeLeft === 0) sprite.filters = []
        else {
          const filterIndex = Math.floor(percentLeft * greyLevels)
          sprite.filters = [greyFilterLevels[filterIndex]]
        }
      } else if (wasVisible && !nowVisible) {
        const filterIndex = greyLevels - Math.ceil(percentLeft * greyLevels)
        sprite.filters = [greyFilterLevels[filterIndex]]
      }
    }
    tween[0] = timeLeft
  })
  tweeningFOV = tweeningSprites.size > 0
}
