import { createWorld, defineQuery, pipe, registerComponents, removeEntity } from 'bitecs'
import {
  Animate,
  Bait,
  DisplayObject,
  WaterCreature,
  GridPosition,
  Health,
  MoveAction,
  Predator,
  SeekWater,
  NoAction,
  CanSwim,
  CanWalk,
  Wander,
  OnTileType,
  Scent,
  Wetness,
  Spotting,
  CalculateFOV,
  Loot,
  Exit,
  Airborne,
  CanAttack,
  AttackAction,
  NonPlayer,
  Snail,
  Mushroom,
} from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { wanderSystem, predatorSystem, seekWaterSystem, noActionSystem, slowSystem } from './enemy_systems'
import {
  waterCreatureSystem,
  gameSystem,
  wetnessSystem,
  playerActionSystem,
  attackSystem,
  enemyActionSystem,
} from './action_systems'
import { runAnimations } from './anim_systems'
import { cameraSystem, fadeSystem, fovSystem, spriteRemoveSystem } from './render_systems'
import { drawHud } from '../hud'
import { updateEntityVisibility, updateVisibility } from '../fov'
import { GameState } from '../'

export const World = createWorld(5000)

const systemGroups = {
  input: inputSystem,
  playerActions: pipe(playerActionSystem, attackSystem, wetnessSystem, gameSystem),
  enemyTurn: pipe(predatorSystem, wanderSystem, seekWaterSystem, noActionSystem, slowSystem),
  enemyActions: pipe(enemyActionSystem, attackSystem, waterCreatureSystem, gameSystem),
  render: pipe(spriteRemoveSystem, fovSystem, cameraSystem, fadeSystem),
}

export let LoopState: 'Waiting' | 'AnimatePlayer' | 'AnimateEnemies' = 'Waiting'

export async function onInput() {
  systemGroups.input(World)
  if (WaitingForInput) return
  systemGroups.playerActions(World) // Execute player actions
  if (GameState === 'Generating') return
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

const nonPlayerEntities = defineQuery([NonPlayer])
export function resetNonPlayerEntities() {
  for (const eid of nonPlayerEntities(World)) {
    removeEntity(World, eid)
  }
}

registerComponents(World, [
  DisplayObject,
  GridPosition,
  MoveAction,
  Animate,
  CanSwim,
  Wander,
  Predator,
  CanWalk,
  Health,
  WaterCreature,
  NoAction,
  SeekWater,
  Bait,
  OnTileType,
  Scent,
  Wetness,
  Spotting,
  CalculateFOV,
  Loot,
  Exit,
  CanAttack,
  Airborne,
  AttackAction,
  NonPlayer,
  Snail,
  Mushroom,
])
