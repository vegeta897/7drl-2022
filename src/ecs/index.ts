import { createWorld, pipe, registerComponents } from 'bitecs'
import {
  ActionTimer,
  AnimateMovement,
  Bait,
  DisplayObject,
  Fish,
  GridPosition,
  Health,
  Lunge,
  MoveAction,
  Player,
  Predator,
  SeekWater,
  Stunned,
  Swimmer,
  Walker,
  Wander,
} from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { runTimer, wanderSystem, predatorSystem, lungeSystem, stunnedSystem, seekWaterSystem } from './enemy_systems'
import { moveSystem, hudSystem } from './action_systems'
import { runAnimations } from './anim_systems'
import { cameraSystem, spriteAddSystem } from './render_systems'

export const World = createWorld()

registerComponents(World, [
  DisplayObject,
  GridPosition,
  MoveAction,
  AnimateMovement,
  ActionTimer,
  Swimmer,
  Wander,
  Predator,
  Lunge,
  Walker,
  Health,
  Player,
  Bait,
  Fish,
  Stunned,
  SeekWater,
])

const systemGroups = {
  input: inputSystem,
  enemyTurn: pipe(predatorSystem, lungeSystem, wanderSystem, stunnedSystem, seekWaterSystem),
  actions: pipe(moveSystem, hudSystem),
  render: pipe(spriteAddSystem, cameraSystem),
}

export async function onInput() {
  systemGroups.input(World)
  if (WaitingForInput) return
  runActions()
  await runAnimations(World)
  await runTimer()
  waitForInput()
}

export const runEnemies = () => systemGroups.enemyTurn(World)
export const runActions = () => systemGroups.actions(World)
export const runRender = () => systemGroups.render(World)
