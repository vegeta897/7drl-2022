import { addComponent, defineQuery, hasComponent, Not, removeComponent, System } from 'bitecs'
import {
  ActionTimer,
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
  Left,
  Right,
  sortByDistance,
  Up,
} from '../vector2'
import { runActions, runEnemies, World } from './'
import { runAnimations } from './anim_systems'
import { EntityMap, findPath, Level, Tile, TileMap } from '../level'

const TURN_TIME = 60
let timer = 0

// TODO: If this timing crap proves too complex, just go back to normal uniform turns and perform multiple movements/actions within one system run

// TODO: Or replace ActionTimer with ActionPoints, enemy spends them

const timerQuery = defineQuery([ActionTimer])

export async function runTimer() {
  while (timer < TURN_TIME) {
    const ready = []
    const waiting = []
    const timerEntities = timerQuery(World) // Run inside loop in case entities are deleted
    let soonestAction = TURN_TIME - timer
    for (const eid of timerEntities) {
      const timeLeft = ActionTimer.timeLeft[eid]
      if (timeLeft === 0) {
        ready.push(eid)
        soonestAction = 0
      } else {
        waiting.push(eid)
        if (timeLeft < soonestAction) soonestAction = timeLeft
      }
    }
    if (ready.length > 0) {
      runEnemies()
      runActions()
      await runAnimations(World)
    }
    timer += soonestAction
    for (const eid of waiting) {
      ActionTimer.timeLeft[eid] -= soonestAction
    }
  }
  timer = 0
}

const predators = defineQuery([GridPosition, ActionTimer, Predator, Not(Lunge), Not(Stunned), Not(SeekWater)])
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
      addComponent(world, Lunge, eid)
      Lunge.power[eid] = distance + 1
      Lunge.direction[eid] = getCardinalDirection(myGrid, grid)
      break
    }
  }
  return world
}

const lungers = defineQuery([GridPosition, Lunge, ActionTimer, Not(Stunned)])
export const lungeSystem: System = (world) => {
  for (const eid of lungers(world)) {
    if (ActionTimer.timeLeft[eid] > 0) continue
    ActionTimer.timeLeft[eid] = 20
    const dir = DirectionGrids[Lunge.direction[eid]]
    addComponent(world, Walker, eid)
    addComponent(world, MoveAction, eid)
    MoveAction.x[eid] = dir.x
    MoveAction.y[eid] = dir.y
    MoveAction.noclip[eid] = 0
    if (--Lunge.power[eid] === 0) removeComponent(world, Lunge, eid)
  }
  return world
}

const wanderers = defineQuery([Wander, GridPosition, ActionTimer, Not(Lunge), Not(Stunned), Not(SeekWater)])
export const wanderSystem: System = (world) => {
  for (const eid of wanderers(world)) {
    if (ActionTimer.timeLeft[eid] > 0) continue
    ActionTimer.timeLeft[eid] = 60
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
    ActionTimer.timeLeft[eid] = 60
    if (--Stunned.remaining[eid] === 0) removeComponent(world, Stunned, eid)
  }
  return world
}

const waterSeekers = defineQuery([SeekWater, Not(Lunge), Not(Stunned)])
export const seekWaterSystem: System = (world) => {
  for (const eid of waterSeekers(world)) {
    if (ActionTimer.timeLeft[eid] > 0) continue
    ActionTimer.timeLeft[eid] = 60
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
