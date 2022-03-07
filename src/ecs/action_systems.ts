// Do player or enemy actions
import {
  AnimateMovement,
  Bait,
  Fish,
  GridPosition,
  Health,
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
import { Log, logAttack, logKill } from '../hud'
import { addVector2, getDistance, getUnitVector2, Vector2, vectorsAreEqual } from '../vector2'

const moveQuery = defineQuery([GridPosition, MoveAction])
export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const move = { x: MoveAction.x[eid], y: MoveAction.y[eid] }
    removeComponent(world, MoveAction, eid)
    const distance = getDistance(move)
    const unitMove = getUnitVector2(move)
    const startGrid = { x: GridPosition.x[eid], y: GridPosition.y[eid] }
    let currentGrid = startGrid
    let targetGrid: Vector2
    let targetGridKey: string
    let targetTileType: Tile
    for (let i = 0; i < distance; i++) {
      targetGrid = addVector2(currentGrid, unitMove)
      targetGridKey = TileMap.keyFromXY(targetGrid.x, targetGrid.y)
      targetTileType = Level.get(targetGridKey!) || 0
      const targetEntity = EntityMap.get(targetGridKey)
      if (targetEntity !== undefined) {
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
          if (eid === PlayerEntity) Log.unshift('You ate the bait')
          if (hasComponent(world, Health, eid)) {
            Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + 1)
          }
          if (hasComponent(world, Fish, eid)) {
            addComponent(world, Stunned, eid)
            Stunned.remaining[eid] = 6
            Log.unshift('The fish is eating the bait')
          }
          removeEntity(world, targetEntity)
          EntityMap.delete(targetGridKey)
          SpritesByEID[targetEntity].destroy()
          delete SpritesByEID[targetEntity]
        } else {
          break
        }
      }
      if (MoveAction.noclip[eid] === 0) {
        if (targetTileType === Tile.Wall) break
        if (targetTileType === Tile.Water && !hasComponent(world, Swimmer, eid)) break
        if (targetTileType === Tile.Floor && !hasComponent(world, Walker, eid)) break
      }
      currentGrid = targetGrid
    }
    if (vectorsAreEqual(startGrid, currentGrid)) continue
    EntityMap.delete(TileMap.keyFromXY(GridPosition.x[eid], GridPosition.y[eid]))
    GridPosition.x[eid] = currentGrid.x
    GridPosition.y[eid] = currentGrid.y
    const currentGridKey = TileMap.keyFromXY(currentGrid.x, currentGrid.y)
    EntityMap.set(currentGridKey, eid)
    const currentTileType = Level.get(currentGridKey) || 0
    if (hasComponent(world, Fish, eid)) {
      if (currentTileType === Tile.Floor) {
        addComponent(world, SeekWater, eid)
        SeekWater.distance[eid] = 6
      } else if (currentTileType === Tile.Water) {
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
