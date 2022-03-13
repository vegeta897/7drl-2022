import { Animate, DisplayObject, GridPosition, OnTileType, WaterCreature } from './components'
import { defineQuery, hasComponent, IWorld, Not, removeComponent, System } from 'bitecs'
import { getTexture, SpritesByEID } from '../sprites'
import { PlayerEntity, TILE_SIZE } from '../'
import { promisedFrame } from '../pixi'
import { Ticker } from 'pixi.js'
import { Animations } from '../animation'
import { isWet } from '../map'
import { CreatureProps } from '../creatures'

export async function runAnimations(world: IWorld) {
  nonAnimatedSystem(world)
  let done = false
  while (!done) {
    await promisedFrame()
    done = animationSystem(world, Ticker.shared.deltaMS)
  }
}

const animated = defineQuery([GridPosition, DisplayObject, Animate])
const animationSystem = (world: IWorld, delta: number): boolean => {
  const toAnimate = animated(world)
  let finishedAnimations = 0
  for (const eid of toAnimate) {
    const elapsed = (Animate.elapsed[eid] += delta)
    const progress = Math.min(1, elapsed / Animate.length[eid])
    let startX = GridPosition.x[eid]
    let startY = GridPosition.y[eid]
    if (Animate.isMovement[eid]) {
      startX -= Animate.x[eid]
      startY -= Animate.y[eid]
    }
    const vector = Animations.get(Animate.type[eid])!(progress, startX, startY, Animate.x[eid], Animate.y[eid])
    SpritesByEID[eid].x = vector.x * TILE_SIZE
    SpritesByEID[eid].y = vector.y * TILE_SIZE
    if (progress === 1) {
      finishedAnimations++
      removeComponent(world, Animate, eid)
      GridPosition.dirty[eid] = 0
      if (isWet(OnTileType.current[eid]) && (hasComponent(world, WaterCreature, eid) || eid === PlayerEntity)) {
        SpritesByEID[eid].texture = getTexture(
          (eid === PlayerEntity ? 'player' : CreatureProps[WaterCreature.type[eid]].texture) + 'Swim'
        )
      }
    }
  }
  return finishedAnimations === toAnimate.length
}

const nonAnimated = defineQuery([GridPosition, DisplayObject, Not(Animate)])
export const nonAnimatedSystem: System = (world) => {
  for (const eid of nonAnimated(world)) {
    if (GridPosition.dirty[eid] === 0) continue
    GridPosition.dirty[eid] = 0
    SpritesByEID[eid].x = GridPosition.x[eid] * TILE_SIZE
    SpritesByEID[eid].y = GridPosition.y[eid] * TILE_SIZE
    if (isWet(OnTileType.current[eid]) && (hasComponent(world, WaterCreature, eid) || eid === PlayerEntity)) {
      SpritesByEID[eid].texture = getTexture(
        (eid === PlayerEntity ? 'player' : CreatureProps[WaterCreature.type[eid]].texture) + 'Swim'
      )
    }
  }
  return world
}
