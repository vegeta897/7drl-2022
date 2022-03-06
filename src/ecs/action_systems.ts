// Do player or enemy actions
import { AnimateMovement, GridPosition, Lunge, MoveAction, Swimmer, Walker } from './components'
import { defineQuery, System, addComponent, removeComponent, hasComponent } from 'bitecs'
import { EntityMap, Level, Tile, TileMap } from '../level'

const moveQuery = defineQuery([GridPosition, MoveAction])
export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const destX = GridPosition.x[eid] + MoveAction.x[eid]
    const destY = GridPosition.y[eid] + MoveAction.y[eid]
    removeComponent(world, MoveAction, eid)
    if (MoveAction.noclip[eid] === 0) {
      const tileType = Level.get(TileMap.keyFromXY(destX, destY)) || 0
      if (tileType === Tile.Wall) continue
      if (tileType === Tile.Water && !hasComponent(world, Swimmer, eid)) continue
      if (tileType === Tile.Floor && !hasComponent(world, Walker, eid)) continue
    }
    const destKey = TileMap.keyFromXY(destX, destY)
    const entityAtDestination = EntityMap.get(destKey)
    if (entityAtDestination !== undefined && entityAtDestination >= 0) {
      console.log(eid, 'attacks', entityAtDestination)
      removeComponent(world, Lunge, eid)
      continue
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
