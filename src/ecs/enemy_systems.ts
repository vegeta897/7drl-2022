import { addComponent, defineQuery, hasComponent, Not, removeComponent, System } from 'bitecs'
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
  Wetness,
  Spotting,
} from './components'
import { RNG } from 'rot-js'
import {
  diffVector2,
  getDiamondAround,
  getDistance,
  getStraightLine,
  sortByDistance,
  vectorsAreInline,
} from '../vector2'
import { EntityMap, findPath, Level } from '../level'
import { Log } from '../hud'
import { Tile } from '../map'
import { PlayerEntity } from '../'
import { RecalcEntities } from '../fov'

const predators = defineQuery([GridPosition, Predator, Not(Stunned), Not(SeekWater)])
const scents = defineQuery([Scent])
export const predatorSystem: System = (world) => {
  for (const eid of predators(world)) {
    const myGrid = getEntGrid(eid)
    if (Level.get(myGrid).type !== Tile.Water) continue
    for (const scentEnt of scents(world)) {
      const scentGrid = getEntGrid(scentEnt)
      const distance = getDistance(myGrid, scentGrid)
      if (distance <= Predator.lungeRange[eid] && vectorsAreInline(myGrid, scentGrid)) {
        if (getStraightLine(myGrid, scentGrid, false).some((t) => Level.get(t).type === Tile.Wall || EntityMap.get(t)))
          continue
        const move = diffVector2(myGrid, scentGrid)
        addComponent(world, MoveAction, eid)
        MoveAction.x[eid] = move.x
        MoveAction.y[eid] = move.y
        MoveAction.noclip[eid] = 0
        addComponent(world, CanWalk, eid)
        Spotting.current[eid] = 2
        RecalcEntities.add(eid)
        if (distance > 1 && scentEnt === PlayerEntity) Log.unshift('The fish lunges at you!')
        break
      }
      const senseRange = Predator.senseRange[eid]
      let scentRange = Scent.range[scentEnt]
      // Scent range amplified by wetness
      if (hasComponent(world, Wetness, scentEnt)) scentRange += Math.round(scentRange * Wetness.factor[scentEnt])
      if (distance >= senseRange + scentRange) continue
      const lingerArea = getDiamondAround(scentGrid, scentRange)
        .filter((g) => getDistance(myGrid, g) <= senseRange)
        .map((g) => ({ ...g, d: getDistance(scentGrid, g) }))
        .sort((a, b) => a.d - b.d)
      for (const lingerGrid of lingerArea) {
        const towardScent = findPath(
          myGrid,
          lingerGrid,
          eid,
          (g) => Level.get(g).type === Tile.Water && !EntityMap.get(g)
        )[0]
        if (!towardScent) continue
        const lingerStrength = (1 + scentRange - lingerGrid.d) / scentRange
        const lingerDistanceFromMe = getDistance(myGrid, lingerGrid)
        const attractChance = 1 - lingerDistanceFromMe / senseRange + lingerStrength
        if (attractChance > RNG.getUniform()) {
          const move = diffVector2(myGrid, towardScent)
          addComponent(world, MoveAction, eid)
          MoveAction.x[eid] = move.x
          MoveAction.y[eid] = move.y
          MoveAction.noclip[eid] = 0
          break
        }
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
    const nearestTiles = sortByDistance(
      myGrid,
      getDiamondAround(myGrid, SeekWater.distance[eid]).filter((g) => Level.get(g).type === Tile.Water)
    )
    for (const tile of nearestTiles) {
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
