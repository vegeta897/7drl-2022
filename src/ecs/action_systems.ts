// Do player or enemy actions
import { AnimateMovement, GridPosition, MoveAction } from './components'
import { defineQuery, System, addComponent, removeComponent } from 'bitecs'
import { Level, TileMap } from '../level'

const moveQuery = defineQuery([GridPosition, MoveAction])

export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const destX = GridPosition.x[eid] + MoveAction.x[eid]
    const destY = GridPosition.y[eid] + MoveAction.y[eid]
    removeComponent(world, MoveAction, eid)
    if (MoveAction.clip[eid] === 0 && Level.get(TileMap.keyFromXY(destX, destY))) continue
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
