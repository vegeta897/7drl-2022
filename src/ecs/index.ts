import { createWorld, pipe, registerComponents } from 'bitecs'
import {
  AnimateMovement,
  DisplayObject,
  Fish,
  GridPosition,
  Health,
  MoveAction,
  Predator,
  SeekWater,
  Stunned,
  Swimmer,
  Walker,
  Wander,
} from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { wanderSystem, predatorSystem, stunnedSystem, seekWaterSystem } from './enemy_systems'
import { moveSystem } from './action_systems'
import { runAnimations } from './anim_systems'
import { cameraSystem, spriteAddSystem } from './render_systems'
import { drawHud } from '../hud'

export const World = createWorld()

registerComponents(World, [
  DisplayObject,
  GridPosition,
  MoveAction,
  AnimateMovement,
  Swimmer,
  Wander,
  Predator,
  Walker,
  Health,
  Fish,
  Stunned,
  SeekWater,
])

const systemGroups = {
  input: inputSystem,
  enemyTurn: pipe(predatorSystem, wanderSystem, stunnedSystem, seekWaterSystem),
  actions: moveSystem,
  render: pipe(spriteAddSystem, cameraSystem),
}

export async function onInput() {
  systemGroups.input(World)
  if (WaitingForInput) return
  runActions() // Execute player actions
  await runAnimations(World) // Animate player actions
  drawHud()
  runEnemies() // Plan enemy actions
  runActions() // Run enemy actions
  await runAnimations(World) // Animate enemy actions
  drawHud()
  waitForInput()
}

export const runEnemies = () => systemGroups.enemyTurn(World)
export const runActions = () => systemGroups.actions(World)
export const runRender = () => systemGroups.render(World)
