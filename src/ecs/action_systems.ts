// Do player or enemy actions
import { AnimateMovement, GridPosition, MoveAction, Swimmer } from './components'
import { defineQuery, System, addComponent, removeComponent, hasComponent } from 'bitecs'
import { Level, Tile, TileMap } from '../level'

const moveQuery = defineQuery([GridPosition, MoveAction])

export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const destX = GridPosition.x[eid] + MoveAction.x[eid]
    const destY = GridPosition.y[eid] + MoveAction.y[eid]
    removeComponent(world, MoveAction, eid)
    if (MoveAction.noclip[eid] === 0) {
      const tileType = Level.get(TileMap.keyFromXY(destX, destY)) || 0
      if (tileType === Tile.Wall) continue
      const swimmer = hasComponent(world, Swimmer, eid)
      if (tileType === Tile.Water && !swimmer) continue
      if (tileType === Tile.Floor && swimmer) continue
    }
    GridPosition.x[eid] = destX
    GridPosition.y[eid] = destY
    // TODO: Don't animate if enemy doesn't have Visible tag
    addComponent(world, AnimateMovement, eid)
    AnimateMovement.x[eid] = MoveAction.x[eid]
    AnimateMovement.y[eid] = MoveAction.y[eid]
    AnimateMovement.elapsed[eid] = 0
    AnimateMovement.length[eid] = 120
  }
  return world
}
