import { AnimateMovement, DisplayObject, GridPosition } from './components'
import { defineQuery, IWorld, Not, removeComponent, System } from 'bitecs'
import { SpritesByEID } from '../sprites'
import { TILE_SIZE } from '../'
import { cubicOut } from '@gamestdio/easing'
import { promisedFrame } from '../pixi'
import { Ticker } from 'pixi.js'

export async function runAnimations(world: IWorld) {
  nonAnimatedSystem(world)
  let done = false
  while (!done) {
    await promisedFrame()
    done = animateMovement(world, Ticker.shared.deltaMS)
  }
}

const animated = defineQuery([GridPosition, DisplayObject, AnimateMovement])
const animateMovement = (world: IWorld, delta: number): boolean => {
  const toAnimate = animated(world)
  let finishedAnimations = 0
  for (const eid of toAnimate) {
    const elapsed = (AnimateMovement.elapsed[eid] += delta)
    const animLength = AnimateMovement.length[eid]
    const inverseProgress = Math.max(0, 1 - cubicOut(elapsed / animLength))
    SpritesByEID[eid].x = (GridPosition.x[eid] - AnimateMovement.x[eid] * inverseProgress) * TILE_SIZE
    SpritesByEID[eid].y = (GridPosition.y[eid] - AnimateMovement.y[eid] * inverseProgress) * TILE_SIZE
    if (inverseProgress === 0) {
      finishedAnimations++
      removeComponent(world, AnimateMovement, eid)
      GridPosition.dirty[eid] = 0
    }
  }
  return finishedAnimations === toAnimate.length
}

const nonAnimated = defineQuery([GridPosition, DisplayObject, Not(AnimateMovement)])
export const nonAnimatedSystem: System = (world) => {
  for (const eid of nonAnimated(world)) {
    if (GridPosition.dirty[eid] === 0) continue
    GridPosition.dirty[eid] = 0
    SpritesByEID[eid].x = GridPosition.x[eid] * TILE_SIZE
    SpritesByEID[eid].y = GridPosition.y[eid] * TILE_SIZE
  }
  return world
}
