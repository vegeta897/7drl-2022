import { addComponent, defineQuery, Not, removeComponent, System } from 'bitecs'
import { ActionTimer, GridPosition, Lunge, MoveAction, SensePlayer, Stunned, Walker, Wander } from './components'
import { RNG } from 'rot-js'
import {
  DirectionGrids,
  Down,
  getCardinalDirection,
  getManhattanDistance,
  Left,
  Right,
  Up,
  vectorsAreInline,
} from '../vector2'
import { runActions, runEnemies, World } from './'
import { runAnimations } from './anim_systems'
import { PlayerEntity } from '../'
import { Level, Tile, TileMap } from '../level'

const TURN_TIME = 60
let timer = 0

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

const playerSensers = defineQuery([GridPosition, ActionTimer, SensePlayer, Not(Lunge), Not(Stunned)])
export const sensePlayerSystem: System = (world) => {
  const playerGrid = { x: GridPosition.x[PlayerEntity], y: GridPosition.y[PlayerEntity] }
  for (const eid of playerSensers(world)) {
    const myGrid = { x: GridPosition.x[eid], y: GridPosition.y[eid] }
    if (Level.get(TileMap.keyFromXY(myGrid.x, myGrid.y)) !== Tile.Water) continue
    if (!vectorsAreInline(myGrid, playerGrid)) continue
    const distance = getManhattanDistance(myGrid, playerGrid)
    if (distance <= 1 || distance > SensePlayer.range[eid]) continue
    addComponent(world, Lunge, eid)
    Lunge.power[eid] = distance
    Lunge.direction[eid] = getCardinalDirection(myGrid, playerGrid)
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
    Lunge.power[eid]--
    if (Lunge.power[eid] === 0) {
      removeComponent(world, Lunge, eid)
      addComponent(world, Wander, eid)
      Wander.maxChance[eid] = 10
      Wander.chance[eid] = 0
    }
  }
  return world
}

const wanderers = defineQuery([Wander, GridPosition, ActionTimer, Not(Lunge), Not(Stunned)])
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
