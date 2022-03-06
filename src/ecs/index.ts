import { createWorld, pipe, registerComponents } from 'bitecs'
import { ActionTimer, AnimateMovement, DisplayObject, GridPosition, MoveAction, Swimmer, Wander } from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { playerSystem } from './player_systems'
import { runTimer, wanderSystem } from './enemy_systems'
import { moveSystem } from './action_systems'
import { runAnimations } from './anim_systems'
import { cameraSystem, spriteAddSystem } from './render_systems'

export const World = createWorld()

registerComponents(World, [DisplayObject, GridPosition, MoveAction, AnimateMovement, ActionTimer, Swimmer, Wander])

const systemGroups = {
  input: inputSystem,
  playerTurn: playerSystem,
  enemyTurn: wanderSystem,
  actions: moveSystem,
  render: pipe(spriteAddSystem, cameraSystem),
}

export async function onInput() {
  systemGroups.input(World)
  if (WaitingForInput) return
  systemGroups.playerTurn(World)
  runActions()
  await runAnimations(World)
  await runTimer()
  waitForInput()
}

export const runEnemies = () => systemGroups.enemyTurn(World)
export const runActions = () => systemGroups.actions(World)
export const runRender = () => systemGroups.render(World)
