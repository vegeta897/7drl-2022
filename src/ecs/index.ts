import { createWorld, pipe, registerComponents } from 'bitecs'
import {
  AnimateMovement,
  Bait,
  DisplayObject,
  Fish,
  GridPosition,
  Health,
  MoveAction,
  Predator,
  SeekWater,
  Stunned,
  CanSwim,
  CanWalk,
  Wander,
  OnTileType,
} from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { wanderSystem, predatorSystem, stunnedSystem, seekWaterSystem } from './enemy_systems'
import { fishSystem, gameSystem, moveSystem, playerSystem } from './action_systems'
import { runAnimations } from './anim_systems'
import { cameraSystem, fadeSystem, fovSystem, spriteAddSystem, spriteRemoveSystem } from './render_systems'
import { drawHud } from '../hud'

// @ts-ignore
export const World = createWorld(5000)

const systemGroups = {
  input: inputSystem,
  enemyTurn: pipe(predatorSystem, wanderSystem, stunnedSystem, seekWaterSystem),
  actions: pipe(moveSystem, playerSystem, fishSystem, gameSystem),
  render: pipe(spriteAddSystem, spriteRemoveSystem, fovSystem, cameraSystem, fadeSystem),
}

export let LoopState: 'Waiting' | 'AnimatePlayer' | 'AnimateEnemies' = 'Waiting'

export async function onInput() {
  systemGroups.input(World)
  if (WaitingForInput) return
  runActions() // Execute player actions
  LoopState = 'AnimatePlayer'
  await runAnimations(World) // Animate player actions
  drawHud()
  runEnemies() // Plan enemy actions
  runActions() // Run enemy actions
  LoopState = 'AnimateEnemies'
  await runAnimations(World) // Animate enemy actions
  drawHud()
  LoopState = 'Waiting'
  waitForInput()
}

export const runEnemies = () => systemGroups.enemyTurn(World)
export const runActions = () => systemGroups.actions(World)
export const runRender = () => systemGroups.render(World)

registerComponents(World, [
  DisplayObject,
  GridPosition,
  MoveAction,
  AnimateMovement,
  CanSwim,
  Wander,
  Predator,
  CanWalk,
  Health,
  Fish,
  Stunned,
  SeekWater,
  Bait,
  OnTileType,
])
