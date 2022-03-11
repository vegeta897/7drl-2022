import { Vector2 } from './vector2'
import { World } from './ecs'
import { Sprite } from 'pixi.js'
import { addSprite, getTexture } from './sprites'
import {
  CalculateFOV,
  CanAttack,
  CanSwim,
  CanWalk,
  DisplayObject,
  GridPosition,
  Health,
  initEntGrid,
  OnTileType,
  Predator,
  Spotting,
  Wander,
  WaterCreature,
} from './ecs/components'
import { ALL_VISIBLE } from './level'
import { addComponent, addEntity } from 'bitecs'
import { RNG } from 'rot-js'

export enum Creature {
  Fish,
  Alligator,
}

export const CreatureProps: {
  texture: string
  wanderChance: number
  canWalk: boolean
  senseRange: number
  baitStunTurns: number
  damage: number
  health: number
  spotting: number
}[] = []
CreatureProps[Creature.Fish] = {
  texture: 'fish',
  wanderChance: 10,
  canWalk: false,
  senseRange: 8,
  baitStunTurns: 6,
  damage: 1,
  health: 4,
  spotting: 0.15,
}
CreatureProps[Creature.Alligator] = {
  texture: 'alligator',
  wanderChance: 40,
  canWalk: true,
  senseRange: 6,
  baitStunTurns: 3,
  damage: 2,
  health: 6,
  spotting: 0.5,
}

export function createWaterCreature(grid: Vector2, rng: typeof RNG) {
  let creatureType = <Creature>(<unknown>rng.getWeightedValue({ [Creature.Alligator]: 1, [Creature.Fish]: 3 }))
  const creature = addEntity(World)
  const creatureProps = CreatureProps[creatureType]
  const creatureSprite = new Sprite(getTexture(creatureProps.texture + 'Swim'))
  if (!ALL_VISIBLE) creatureSprite.alpha = 0
  addSprite(creature, creatureSprite)
  addComponent(World, DisplayObject, creature)
  addComponent(World, OnTileType, creature)
  addComponent(World, GridPosition, creature)
  initEntGrid(creature, grid)
  addComponent(World, Wander, creature)
  Wander.maxChance[creature] = creatureProps.wanderChance
  Wander.chance[creature] = rng.getUniformInt(0, 10)
  addComponent(World, CanSwim, creature)
  if (creatureProps.canWalk) addComponent(World, CanWalk, creature)
  addComponent(World, Predator, creature)
  Predator.lungeRange[creature] = 4
  Predator.senseRange[creature] = creatureProps.senseRange
  Predator.baitStunTurns[creature] = creatureProps.baitStunTurns
  addComponent(World, CanAttack, creature)
  CanAttack.damage[creature] = creatureProps.damage
  addComponent(World, Health, creature)
  Health.max[creature] = creatureProps.health
  Health.current[creature] = creatureProps.health
  addComponent(World, WaterCreature, creature)
  WaterCreature.type[creature] = creatureType
  addComponent(World, CalculateFOV, creature)
  addComponent(World, Spotting, creature)
  Spotting.current[creature] = 0
  Spotting.increaseBy[creature] = creatureProps.spotting
}
