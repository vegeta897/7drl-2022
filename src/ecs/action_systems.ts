// Do player or enemy actions
import {
  AnimateMovement,
  Bait,
  Fish,
  GridPosition,
  Health,
  Lunge,
  MoveAction,
  SeekWater,
  Stunned,
  Swimmer,
  Walker,
} from './components'
import { defineQuery, System, addComponent, removeComponent, hasComponent, removeEntity } from 'bitecs'
import { EntityMap, Level, Tile, TileMap } from '../level'
import { PlayerEntity } from '../'
import { SpritesByEID } from '../sprites'
import { drawHud, Log, logAttack, logKill } from '../hud'

const moveQuery = defineQuery([GridPosition, MoveAction])
export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const targetX = GridPosition.x[eid] + MoveAction.x[eid]
    const targetY = GridPosition.y[eid] + MoveAction.y[eid]
    removeComponent(world, MoveAction, eid)
    const targetGridKey = TileMap.keyFromXY(targetX, targetY)
    const targetEntity = EntityMap.get(targetGridKey)
    if (targetEntity !== undefined && targetEntity >= 0) {
      const playerInvolved = [eid, targetEntity].includes(PlayerEntity)
      const attackedHasHealth = hasComponent(world, Health, targetEntity)
      if (playerInvolved && attackedHasHealth) {
        let damage = 1
        if (hasComponent(world, Stunned, targetEntity)) {
          damage = 5
          removeComponent(world, Stunned, targetEntity)
        }
        logAttack(eid, targetEntity, damage)
        const healthLeft = (Health.current[targetEntity] -= damage)
        if (healthLeft <= 0) {
          if (eid === PlayerEntity) logKill(targetEntity)
          removeEntity(world, targetEntity)
          EntityMap.delete(targetGridKey)
          SpritesByEID[targetEntity].destroy()
          delete SpritesByEID[targetEntity]
        }
      }
      if (hasComponent(world, Bait, targetEntity)) {
        if (eid === PlayerEntity) Log.push('You ate the bait')
        if (hasComponent(world, Health, eid)) {
          Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + 1)
        }
        if (hasComponent(world, Fish, eid)) {
          addComponent(world, Stunned, eid)
          Stunned.remaining[eid] = 6
          Log.push('The fish is eating the bait')
        }
        removeEntity(world, targetEntity)
        EntityMap.delete(targetGridKey)
        SpritesByEID[targetEntity].destroy()
        delete SpritesByEID[targetEntity]
      } else {
        removeComponent(world, Lunge, eid)
        continue
      }
    }
    const tileType = Level.get(targetGridKey) || 0
    if (MoveAction.noclip[eid] === 0) {
      if (tileType === Tile.Wall) continue
      if (tileType === Tile.Water && !hasComponent(world, Swimmer, eid)) continue
      if (tileType === Tile.Floor && !hasComponent(world, Walker, eid)) continue
    }
    EntityMap.delete(TileMap.keyFromXY(GridPosition.x[eid], GridPosition.y[eid]))
    GridPosition.x[eid] = targetX
    GridPosition.y[eid] = targetY
    EntityMap.set(targetGridKey, eid)
    if (hasComponent(world, Fish, eid)) {
      if (tileType === Tile.Floor) {
        addComponent(world, SeekWater, eid)
        SeekWater.distance[eid] = 6
      } else if (tileType === Tile.Water) {
        removeComponent(world, Walker, eid)
        removeComponent(world, SeekWater, eid)
      }
    }
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
