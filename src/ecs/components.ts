import { ComponentType, defineComponent, hasComponent, Types } from 'bitecs'
import { Vector2 } from '../vector2'
import { EntityMap } from '../level'
import { PlayerEntity, PlayerSprite, TILE_SIZE } from '../'
import { RecalcEntities, triggerTileUpdate, updateEntityVisibility } from '../fov'
import { SpritesByEID } from '../sprites'
import { PixiViewport } from '../pixi'
import { World } from './index'

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
export const Chest = defineComponent()
export const Exit = defineComponent()

export const Scent = defineComponent({ range: Types.ui8 })
export const Wetness = defineComponent({ factor: Types.f32 })
export const Spotting = defineComponent({ current: Types.f32, increaseBy: Types.f32 })

export const CalculateFOV = defineComponent({ distance: Types.i8 })

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

export function initEntGrid(eid: number, grid: Vector2) {
  setEntGrid(eid, grid)
  if (SpritesByEID[eid]) {
    SpritesByEID[eid].x = grid.x * TILE_SIZE
    SpritesByEID[eid].y = grid.y * TILE_SIZE
  }
}

export function setEntGrid(eid: number, grid: Vector2) {
  GridPosition.x[eid] = grid.x
  GridPosition.y[eid] = grid.y
  GridPosition.dirty[eid] = 1
  EntityMap.set(grid, eid)
  if (eid === PlayerEntity) {
    // Update all entity visibility
    triggerTileUpdate()
  } else {
    // Update only this entity's visibility
    RecalcEntities.add(eid)
  }
}

export function deleteEntGrid(eid: number) {
  EntityMap.delete(getEntGrid(eid))
}
