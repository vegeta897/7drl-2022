import { ComponentType, defineComponent, hasComponent, Types } from 'bitecs'
import { Vector2 } from '../vector2'
import { EntityMap, Level } from '../level'
import { PlayerEntity } from '../'
import { triggerEntityUpdate, triggerTileUpdate } from '../fov'
import { World } from './'

export const DisplayObject = defineComponent()

const GridC = {
  x: Types.i32,
  y: Types.i32,
}

export const GridPosition = defineComponent({ ...GridC, dirty: Types.ui8 })

export const MoveAction = defineComponent({ ...GridC, noclip: Types.ui8 })

export const AnimateMovement = defineComponent({
  ...GridC,
  elapsed: Types.f32,
  length: Types.f32,
})

export const Health = defineComponent({ current: Types.ui16, max: Types.ui16 })
export const CanWalk = defineComponent()
export const CanSwim = defineComponent()
export const Wander = defineComponent({ chance: Types.ui8, maxChance: Types.ui8 })
export const Predator = defineComponent({ lungeRange: Types.ui8, senseRange: Types.ui8 })
export const Stunned = defineComponent({ remaining: Types.ui16 })
export const SeekWater = defineComponent({ distance: Types.ui8 })

export const OnTileType = defineComponent({ current: Types.ui8, previous: Types.ui8 })

export const Fish = defineComponent()
export const Bait = defineComponent()
export const Scent = defineComponent({ strength: Types.f32 })

export const vector2FromC = (component: ComponentType<typeof GridC>, eid: number) => ({
  x: component.x[eid],
  y: component.y[eid],
})

export function getEntGrid(eid: number) {
  return vector2FromC(GridPosition, eid)
}

export function changeEntGrid(eid: number, grid: Vector2) {
  EntityMap.delete(getEntGrid(eid))
  setEntGrid(eid, grid)
}

export function setEntGrid(eid: number, grid: Vector2) {
  GridPosition.x[eid] = grid.x
  GridPosition.y[eid] = grid.y
  GridPosition.dirty[eid] = 1
  EntityMap.set(grid, eid)
  if (hasComponent(World, OnTileType, eid)) {
    OnTileType.previous[eid] = OnTileType.current[eid]
    OnTileType.current[eid] = Level.get(grid).type
  }
  if (eid === PlayerEntity) triggerTileUpdate()
  else triggerEntityUpdate()
}

export function deleteEntGrid(eid: number) {
  EntityMap.delete(getEntGrid(eid))
}
