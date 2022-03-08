import { addComponent, defineQuery, Not, removeComponent, System } from 'bitecs'
import { getEntGrid, GridPosition, MoveAction, Predator, SeekWater, Stunned, Walker, Wander } from './components'
import { RNG } from 'rot-js'
import {
  diffVector2,
  Down,
  getCross,
  getDiamondAround,
  getDistance,
  getStraightLine,
  Left,
  Right,
  sortByDistance,
  Up,
} from '../vector2'
import { EntityMap, findPath, Level, Tile } from '../level'
import { Log } from '../hud'
import { PlayerEntity } from '../index'
import { BaitEntity } from './input_systems'

const predators = defineQuery([GridPosition, Predator, Not(Stunned), Not(SeekWater)])
export const predatorSystem: System = (world) => {
  for (const eid of predators(world)) {
    const myGrid = getEntGrid(eid)
    if (Level.get(myGrid) !== Tile.Water) continue
    const senseArea = getCross(myGrid, Predator.range[eid])
    for (const grid of senseArea) {
      const distance = getDistance(myGrid, grid)
      if (distance <= 1 || distance > Predator.range[eid]) continue
      const entityAtGrid = EntityMap.get(grid)
      if (entityAtGrid === undefined) continue
      if (![PlayerEntity, BaitEntity].includes(entityAtGrid)) continue
      if (getStraightLine(myGrid, grid, false).some((t) => Level.get(t) === Tile.Wall)) continue
      const move = diffVector2(myGrid, grid)
      addComponent(world, MoveAction, eid)
      MoveAction.x[eid] = move.x
      MoveAction.y[eid] = move.y
      MoveAction.noclip[eid] = 0
      addComponent(world, Walker, eid)
      Log.unshift('The fish lunges out of the water!')
      break
    }
  }
  return world
}

const wanderers = defineQuery([Wander, GridPosition, Not(Stunned), Not(SeekWater), Not(MoveAction)])
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

const waterSeekers = defineQuery([SeekWater, Not(Stunned)])
export const seekWaterSystem: System = (world) => {
  for (const eid of waterSeekers(world)) {
    const myGrid = getEntGrid(eid)
    const nearestTiles = sortByDistance(myGrid, getDiamondAround(myGrid, SeekWater.distance[eid]))
    for (const tile of nearestTiles) {
      if (Level.get(tile) !== Tile.Water) continue
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
