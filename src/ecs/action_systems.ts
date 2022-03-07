// Do player or enemy actions
import {
  AnimateMovement,
  Bait,
  Fish,
  GridPosition,
  Health,
  Lunge,
  MoveAction,
  Stunned,
  Swimmer,
  Walker,
} from './components'
import { defineQuery, System, addComponent, removeComponent, hasComponent, removeEntity } from 'bitecs'
import { EntityMap, Level, Tile, TileMap } from '../level'
import { PlayerEntity } from '../'
import { SpritesByEID } from '../sprites'
import { drawHud } from '../hud'

const moveQuery = defineQuery([GridPosition, MoveAction])
export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const destX = GridPosition.x[eid] + MoveAction.x[eid]
    const destY = GridPosition.y[eid] + MoveAction.y[eid]
    removeComponent(world, MoveAction, eid)
    const destKey = TileMap.keyFromXY(destX, destY)
    const entityAtDestination = EntityMap.get(destKey)
    if (entityAtDestination !== undefined && entityAtDestination >= 0) {
      const playerInvolved = [eid, entityAtDestination].includes(PlayerEntity)
      const attackedHasHealth = hasComponent(world, Health, entityAtDestination)
      if (playerInvolved && attackedHasHealth) {
        let damage = 1
        if (hasComponent(world, Stunned, entityAtDestination)) {
          damage = 5
          removeComponent(world, Stunned, entityAtDestination)
        }
        const healthLeft = (Health.current[entityAtDestination] -= damage)
        if (healthLeft <= 0) {
          removeEntity(world, entityAtDestination)
          EntityMap.delete(destKey)
          SpritesByEID[entityAtDestination].destroy()
          delete SpritesByEID[entityAtDestination]
        }
      }
      if (hasComponent(world, Bait, entityAtDestination)) {
        if (hasComponent(world, Health, eid)) {
          Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + 1)
        }
        if (hasComponent(world, Fish, eid)) {
          addComponent(world, Stunned, eid)
          Stunned.remaining[eid] = 6
        }
        removeEntity(world, entityAtDestination)
        EntityMap.delete(destKey)
        SpritesByEID[entityAtDestination].destroy()
        delete SpritesByEID[entityAtDestination]
      } else {
        removeComponent(world, Lunge, eid)
        continue
      }
    }
    if (MoveAction.noclip[eid] === 0) {
      const tileType = Level.get(destKey) || 0
      if (tileType === Tile.Wall) continue
      if (tileType === Tile.Water && !hasComponent(world, Swimmer, eid)) continue
      if (tileType === Tile.Floor && !hasComponent(world, Walker, eid)) continue
    }
    EntityMap.delete(TileMap.keyFromXY(GridPosition.x[eid], GridPosition.y[eid]))
    GridPosition.x[eid] = destX
    GridPosition.y[eid] = destY
    EntityMap.set(destKey, eid)
    // TODO: Don't animate if enemy doesn't have Visible tag
    addComponent(world, AnimateMovement, eid)
    AnimateMovement.x[eid] = MoveAction.x[eid]
    AnimateMovement.y[eid] = MoveAction.y[eid]
    AnimateMovement.elapsed[eid] = 0
    AnimateMovement.length[eid] = 100
  }
  return world
}

export const hudSystem: System = (world) => {
  drawHud()
  return world
}
