import { AnimateMovement, DisplayObject, GridPosition } from './components'
import { Changed, defineQuery, IWorld, Not, removeComponent, System } from 'bitecs'
import { SpritesByEID } from '../sprites'
import { TILE_SIZE } from '../'
import { cubicOut } from '@gamestdio/easing'
import { promisedFrame } from '../pixi'

export async function runAnimations(world: IWorld) {
  let last = performance.now()
  let done = false
  while (!done) {
    const now = await promisedFrame()
    done = animateMovement(world, now - last)
    last = now
  }
  nonAnimatedSystem(world)
}

const animated = defineQuery([GridPosition, DisplayObject, AnimateMovement])
const animateMovement = (world: IWorld, delta: number): boolean => {
  const toAnimate = animated(world)
  if (toAnimate.length === 0) return true
  for (const eid of toAnimate) {
    const elapsed = (AnimateMovement.elapsed[eid] += delta)
    const animLength = AnimateMovement.length[eid]
    const inverseProgress = Math.max(0, 1 - cubicOut(elapsed / animLength))
    SpritesByEID[eid].x = (GridPosition.x[eid] - AnimateMovement.x[eid] * inverseProgress) * TILE_SIZE
    SpritesByEID[eid].y = (GridPosition.y[eid] - AnimateMovement.y[eid] * inverseProgress) * TILE_SIZE
    if (inverseProgress === 0) {
      removeComponent(world, AnimateMovement, eid)
    }
  }
  return false
}

// If perf is bad with Changed, use a dirty flag
const nonAnimated = defineQuery([Changed(GridPosition), DisplayObject, Not(AnimateMovement)])
export const nonAnimatedSystem: System = (world) => {
  for (const eid of nonAnimated(world)) {
    SpritesByEID[eid].x = GridPosition.x[eid] * TILE_SIZE
    SpritesByEID[eid].y = GridPosition.y[eid] * TILE_SIZE
  }
  return world
}
