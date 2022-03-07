import { addComponent, defineQuery, hasComponent, Not, removeComponent, System } from 'bitecs'
import {
  Bait,
  GridPosition,
  Lunge,
  MoveAction,
  Player,
  Predator,
  SeekWater,
  Stunned,
  Walker,
  Wander,
} from './components'
import { RNG } from 'rot-js'
import {
  diffVector2,
  DirectionGrids,
  Down,
  getCardinalDirection,
  getCross,
  getDiamondAround,
  getDistance,
  getStraightLine,
  Left,
  Right,
  scaleVector2,
  sortByDistance,
  Up,
} from '../vector2'
import { EntityMap, findPath, Level, Tile, TileMap } from '../level'
import { Log } from '../hud'

const predators = defineQuery([GridPosition, Predator, Not(Lunge), Not(Stunned), Not(SeekWater)])
export const predatorSystem: System = (world) => {
  for (const eid of predators(world)) {
    const myGrid = { x: GridPosition.x[eid], y: GridPosition.y[eid] }
    if (Level.get(TileMap.keyFromXY(myGrid.x, myGrid.y)) !== Tile.Water) continue
    const senseArea = getCross(myGrid, Predator.range[eid])
    for (const grid of senseArea) {
      const distance = getDistance(myGrid, grid)
      if (distance <= 1 || distance > Predator.range[eid]) continue
      const entityAtGrid = EntityMap.get(TileMap.keyFromXY(grid.x, grid.y))
      if (entityAtGrid === undefined) continue
      if (!hasComponent(world, Player, entityAtGrid) && !hasComponent(world, Bait, entityAtGrid)) continue
      if (getStraightLine(myGrid, grid, false).some(({ x, y }) => Level.get(TileMap.keyFromXY(x, y)) === Tile.Wall))
        continue
      addComponent(world, Lunge, eid)
      Lunge.power[eid] = distance
      Lunge.direction[eid] = getCardinalDirection(myGrid, grid)
      Log.unshift('The fish lunges out of the water!')
      break
    }
  }
  return world
}

const lungeBois = defineQuery([GridPosition, Lunge, Not(Stunned)])
export const lungeSystem: System = (world) => {
  for (const eid of lungeBois(world)) {
    const move = scaleVector2(DirectionGrids[Lunge.direction[eid]], Lunge.power[eid])
    addComponent(world, Walker, eid)
    addComponent(world, MoveAction, eid)
    console.log(Lunge.power[eid], move.x, move.y)
    MoveAction.x[eid] = move.x
    MoveAction.y[eid] = move.y
    MoveAction.noclip[eid] = 0
    removeComponent(world, Lunge, eid)
  }
  return world
}

const wanderers = defineQuery([Wander, GridPosition, Not(Lunge), Not(Stunned), Not(SeekWater)])
export const wanderSystem: System = (world) => {
  for (const eid of wanderers(world)) {
    if (RNG.getUniform() > Wander.chance[eid] / Wander.maxChance[eid]) {
      Wander.chance[eid]++
      continue
    }
    Wander.chance[eid] = 0
    const dir = RNG.getItem([Up, Down, Left, Right])!
    addComponent(world, MoveAction, eid)
    MoveAction.x[eid] = dir.x
    MoveAction.y[eid] = dir.y
    MoveAction.noclip[eid] = 0
  }
  return world
}

const stunned = defineQuery([Stunned])
export const stunnedSystem: System = (world) => {
  for (const eid of stunned(world)) {
    if (--Stunned.remaining[eid] === 0) removeComponent(world, Stunned, eid)
  }
  return world
}

const waterSeekers = defineQuery([SeekWater, Not(Lunge), Not(Stunned)])
export const seekWaterSystem: System = (world) => {
  for (const eid of waterSeekers(world)) {
    const myGrid = { x: GridPosition.x[eid], y: GridPosition.y[eid] }
    const nearestTiles = sortByDistance(myGrid, getDiamondAround(myGrid, SeekWater.distance[eid]))
    for (const tile of nearestTiles) {
      if (Level.get(TileMap.keyFromXY(tile.x, tile.y)) !== Tile.Water) continue
      const towardWater = findPath(myGrid, tile, eid)[0]
      if (towardWater) {
        const move = diffVector2(myGrid, towardWater)
        addComponent(world, MoveAction, eid)
        MoveAction.x[eid] = move.x
        MoveAction.y[eid] = move.y
        MoveAction.noclip[eid] = 0
        break
      }
    }
  }
  return world
}
