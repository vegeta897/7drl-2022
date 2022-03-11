import { createWorld, defineQuery, pipe, registerComponents, removeEntity } from 'bitecs'
import {
  AnimateMovement,
  Bait,
  DisplayObject,
  WaterCreature,
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
  Chest,
  Exit,
  Airborne,
  CanAttack,
  AttackAction,
} from './components'
import { inputSystem, waitForInput, WaitingForInput } from './input_systems'
import { wanderSystem, predatorSystem, seekWaterSystem, stunnedSystem } from './enemy_systems'
import {
  waterCreatureSystem,
  gameSystem,
  moveSystem,
  wetnessSystem,
  playerActionSystem,
  attackSystem,
  enemyActionSystem,
} from './action_systems'
import { runAnimations } from './anim_systems'
import { cameraSystem, fadeSystem, fovSystem, spriteRemoveSystem } from './render_systems'
import { drawHud } from '../hud'
import { updateEntityVisibility, updateVisibility } from '../fov'
import { GameState, PlayerEntity } from '../index'

export const World = createWorld(5000)

const systemGroups = {
  input: inputSystem,
  enemyTurn: pipe(predatorSystem, wanderSystem, stunnedSystem, seekWaterSystem),
  enemyActions: pipe(enemyActionSystem, moveSystem, attackSystem, waterCreatureSystem, gameSystem),
  playerActions: pipe(playerActionSystem, moveSystem, attackSystem, wetnessSystem, gameSystem),
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

const allEntities = defineQuery([])
export function resetNonPlayerEntities() {
  for (const eid of allEntities(World)) {
    if (eid !== PlayerEntity) removeEntity(World, eid)
  }
}

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
  WaterCreature,
  Stunned,
  SeekWater,
  Bait,
  OnTileType,
  Scent,
  Wetness,
  Spotting,
  CalculateFOV,
  Chest,
  Exit,
  CanAttack,
  Airborne,
  AttackAction,
])
