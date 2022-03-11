import { addComponent, defineQuery, hasComponent, Not, removeComponent, System } from 'bitecs'
import {
  getEntGrid,
  GridPosition,
  MoveAction,
  Predator,
  SeekWater,
  NoAction,
  Wander,
  Scent,
  Wetness,
  Spotting,
  Airborne,
  CanWalk,
  WaterCreature,
  Statuses,
  Health,
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
import { logLunge, logCreatureStatus } from '../hud'
import { isWalkable, isWet } from '../map'
import { PlayerEntity } from '../'
import { RecalcEntities } from '../fov'
import { Creature } from '../creatures'

const predators = defineQuery([GridPosition, Predator, Not(NoAction)])
const scents = defineQuery([Scent])
export const predatorSystem: System = (world) => {
  for (const eid of predators(world)) {
    const myGrid = getEntGrid(eid)
    if (!isWet(Level.get(myGrid).type) && !hasComponent(world, CanWalk, eid) && hasComponent(world, Wander, eid)) {
      Wander.chance[eid] = 100 // Floundering
      addComponent(world, Airborne, eid)
      continue
    }
    for (const scentEnt of scents(world)) {
      const scentGrid = getEntGrid(scentEnt)
      const distance = getDistance(myGrid, scentGrid)
      // TODO: Lunge with pathfinding instead of just straight lines?
      // And their aim might not be perfect?
      if (
        distance <= Predator.lungeRange[eid] &&
        vectorsAreInline(myGrid, scentGrid) &&
        !getStraightLine(myGrid, scentGrid, false).some((t) => Level.get(t).solid || EntityMap.get(t))
      ) {
        const move = diffVector2(myGrid, scentGrid)
        addComponent(world, MoveAction, eid)
        MoveAction.x[eid] = move.x
        MoveAction.y[eid] = move.y
        MoveAction.noclip[eid] = 0
        Spotting.current[eid] = 2
        RecalcEntities.add(eid)
        addComponent(world, Airborne, eid)
        if (distance > 1 && scentEnt === PlayerEntity) logLunge(eid)
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
          (g) =>
            ((hasComponent(world, CanWalk, eid) && isWalkable(Level.get(g).type)) || isWet(Level.get(g).type)) &&
            !EntityMap.get(g)
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

const wanderers = defineQuery([Wander, GridPosition, Not(NoAction), Not(MoveAction)])
export const wanderSystem: System = (world) => {
  for (const eid of wanderers(world)) {
    if (RNG.getUniform() > Wander.chance[eid] / Wander.maxChance[eid]) {
      Wander.chance[eid]++
      continue
    }
    Wander.chance[eid] = 0
    const myGrid = getEntGrid(eid)
    const inWater = isWet(Level.get(myGrid).type)
    const creatureType = WaterCreature.type[eid]
    const choices = Level.get4Neighbors(myGrid).filter((t) => {
      if (creatureType === Creature.Fish) return isWet(t.type) || hasComponent(world, Airborne, eid)
      if (creatureType === Creature.Alligator) return inWater || isWet(t.type)
      return true // Turtles can walk anywhere
    })
    if (choices.length === 0) continue
    const dir = diffVector2(myGrid, RNG.getItem(choices)!)
    addComponent(world, MoveAction, eid)
    MoveAction.x[eid] = dir.x
    MoveAction.y[eid] = dir.y
    MoveAction.noclip[eid] = 0
  }
  return world
}

const waterSeekers = defineQuery([SeekWater, Not(NoAction)])
export const seekWaterSystem: System = (world) => {
  for (const eid of waterSeekers(world)) {
    const myGrid = getEntGrid(eid)
    const nearestTiles = sortByDistance(
      myGrid,
      getDiamondAround(myGrid, SeekWater.distance[eid]).filter((g) => isWet(Level.get(g).type))
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

const nonActors = defineQuery([NoAction])
export const noActionSystem: System = (world) => {
  for (const eid of nonActors(world)) {
    if (--NoAction.remaining[eid] === 0) {
      if (NoAction.status[eid] === Statuses.Eating) {
        let healed = false
        if (hasComponent(world, Health, eid) && Health.current[eid] < Health.max[eid]) {
          Health.current[eid]++
          healed = true
        }
        logCreatureStatus(eid, NoAction.status[eid], true, healed ? ' (+1 hp)' : '')
      }
      removeComponent(world, NoAction, eid)
    }
  }
  return world
}
