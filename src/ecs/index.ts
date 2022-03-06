import { createWorld, pipe, registerComponents } from 'bitecs'
import {
  ActionTimer,
  AnimateMovement,
  DisplayObject,
  GridPosition,
  Health,
  Lunge,
  MoveAction,
  Player,
  SensePlayer,
  Swimmer,
  Walker,
  Wander,
} from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { runTimer, wanderSystem, sensePlayerSystem, lungeSystem } from './enemy_systems'
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
  SensePlayer,
  Lunge,
  Walker,
  Health,
  Player,
])

const systemGroups = {
  input: inputSystem,
  enemyTurn: pipe(sensePlayerSystem, lungeSystem, wanderSystem),
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
