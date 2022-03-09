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
  Scent,
  Wetness,
  Spotting,
  CalculateFOV,
} from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { wanderSystem, predatorSystem, stunnedSystem, seekWaterSystem } from './enemy_systems'
import { fishSystem, gameSystem, moveSystem, wetnessSystem } from './action_systems'
import { runAnimations } from './anim_systems'
import { cameraSystem, fadeSystem, fovSystem, spriteAddSystem, spriteRemoveSystem } from './render_systems'
import { drawHud } from '../hud'
import { updateEntityVisibility, updateVisibility } from '../fov'

// @ts-ignore
export const World = createWorld(5000)

const systemGroups = {
  input: inputSystem,
  enemyTurn: pipe(predatorSystem, wanderSystem, stunnedSystem, seekWaterSystem),
  enemyActions: pipe(moveSystem, fishSystem, gameSystem),
  playerActions: pipe(moveSystem, wetnessSystem, gameSystem),
  render: pipe(spriteAddSystem, spriteRemoveSystem, fovSystem, cameraSystem, fadeSystem),
}

export let LoopState: 'Waiting' | 'AnimatePlayer' | 'AnimateEnemies' = 'Waiting'

export async function onInput() {
  systemGroups.input(World)
  if (WaitingForInput) return
  systemGroups.playerActions(World) // Execute player actions
  updateVisibility()
  updateEntityVisibility()
  LoopState = 'AnimatePlayer'
  await runAnimations(World) // Animate player actions
  drawHud()
  systemGroups.enemyTurn(World) // Plan enemy actions
  systemGroups.enemyActions(World) // Run enemy actions
  updateVisibility()
  updateEntityVisibility()
  LoopState = 'AnimateEnemies'
  await runAnimations(World) // Animate enemy actions
  drawHud()
  LoopState = 'Waiting'
  waitForInput()
}

export const runRender = () => systemGroups.render(World)

console.log('registering components')
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
  Scent,
  Wetness,
  Spotting,
  CalculateFOV,
])
