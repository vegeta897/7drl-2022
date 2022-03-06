import { addComponent, defineQuery } from 'bitecs'
import { ActionTimer, MoveAction } from './components'
import { RNG } from 'rot-js'
import { Down, Left, Right, Up } from '../vector2'
import { runActions, World } from './'
import { runAnimations } from './anim_systems'

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
      createEnemyActions(ready)
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

// const randomWalkQuery = defineQuery([ActionTimer, GridPosition, RandomWalk])

function createEnemyActions(entities: number[]) {
  for (const eid of entities) {
    ActionTimer.timeLeft[eid] = 30
    const dir = RNG.getItem([Up, Down, Left, Right])!
    addComponent(World, MoveAction, eid)
    MoveAction.x[eid] = dir.x
    MoveAction.y[eid] = dir.y
    MoveAction.clip[eid] = 0
  }
}
