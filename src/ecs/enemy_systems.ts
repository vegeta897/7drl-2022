import { addComponent, defineQuery, Not, removeComponent, System } from 'bitecs'
import {
  getEntGrid,
  GridPosition,
  MoveAction,
  Predator,
  SeekWater,
  Stunned,
  CanWalk,
  Wander,
  Scent,
} from './components'
import { RNG } from 'rot-js'
import {
  diffVector2,
  Down,
  getDiamondAround,
  getDistance,
  getStraightLine,
  Left,
  Right,
  sortByDistance,
  Up,
  vectorsAreInline,
} from '../vector2'
import { findPath, Level } from '../level'
import { Log } from '../hud'
import { Tile } from '../map'

const predators = defineQuery([GridPosition, Predator, Not(Stunned), Not(SeekWater)])
const scents = defineQuery([Scent])
export const predatorSystem: System = (world) => {
  for (const eid of predators(world)) {
    const myGrid = getEntGrid(eid)
    if (Level.get(myGrid).type !== Tile.Water) continue
    for (const scentEnt of scents(world)) {
      const scentGrid = getEntGrid(scentEnt)
      const distance = getDistance(myGrid, scentGrid)
      if (distance > Predator.senseRange[eid]) continue
      if (distance <= Predator.lungeRange[eid] && vectorsAreInline(myGrid, scentGrid)) {
        if (getStraightLine(myGrid, scentGrid, false).some((t) => Level.get(t).type === Tile.Wall)) continue
        const move = diffVector2(myGrid, scentGrid)
        addComponent(world, MoveAction, eid)
        MoveAction.x[eid] = move.x
        MoveAction.y[eid] = move.y
        MoveAction.noclip[eid] = 0
        addComponent(world, CanWalk, eid)
        if (distance > 1) Log.unshift('The fish lunges at you!')
        break
      }
      const nearness = (Predator.senseRange[eid] - distance) / Predator.senseRange[eid]
      const attractChance = nearness * Scent.strength[scentEnt]
      if (attractChance > RNG.getUniform()) {
        const towardScent = findPath(myGrid, scentGrid, eid, (grid) => Level.get(grid).type === Tile.Water)[0]
        if (!towardScent) continue
        const move = diffVector2(myGrid, towardScent)
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

const wanderers = defineQuery([Wander, GridPosition, Not(Stunned), Not(SeekWater), Not(MoveAction)])
export const wanderSystem: System = (world) => {
  for (const eid of wanderers(world)) {
    if (RNG.getUniform() > Wander.chance[eid] / Wander.maxChance[eid]) {
      Wander.chance[eid]++
      continue
    }
    Wander.chance[eid] = 0
    const myGrid = getEntGrid(eid)
    const choices = Level.get4Neighbors(myGrid).filter((t) => t.type === Tile.Water)
    if (choices.length === 0) continue
    const dir = diffVector2(myGrid, RNG.getItem(choices)!)
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
      if (Level.get(tile).type !== Tile.Water) continue
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
