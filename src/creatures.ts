import { getDistance, Vector2 } from './vector2'
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
  NonPlayer,
  OnTileType,
  Predator,
  Spotting,
  Wander,
  WaterCreature,
} from './ecs/components'
import { ALL_VISIBLE, EntityMap, Level } from './level'
import { addComponent, addEntity } from 'bitecs'
import { RNG } from 'rot-js'
import { isWet, TileData } from './map'

export enum Creature {
  Fish = 1,
  Alligator,
  Turtle,
  GiantSnail,
}

export const CreatureProps: {
  texture: string
  name?: string
  wanderChance?: number
  canWalk?: boolean
  walkSlowness?: number
  canSwim?: boolean
  swimSlowness?: number
  senseRange?: number
  lungeRange?: number
  eatingTurns?: number
  damage?: number
  health?: number
  spotting?: number
}[] = []
CreatureProps[Creature.Fish] = {
  texture: 'fish',
  wanderChance: 10,
  canSwim: true,
  senseRange: 8,
  lungeRange: 4,
  eatingTurns: 6,
  damage: 1,
  health: 4,
  spotting: 0.15,
}
CreatureProps[Creature.Alligator] = {
  texture: 'alligator',
  wanderChance: 100,
  canWalk: true,
  canSwim: true,
  swimSlowness: 1,
  senseRange: 6,
  lungeRange: 3,
  eatingTurns: 3,
  damage: 2,
  health: 6,
  spotting: 0.5,
}
CreatureProps[Creature.Turtle] = {
  texture: 'turtle',
  wanderChance: 400,
  canWalk: true,
  canSwim: true,
}
CreatureProps[Creature.GiantSnail] = {
  texture: 'giantSnail',
  name: 'giant snail',
  wanderChance: 300,
  canWalk: true,
  walkSlowness: 2,
  senseRange: 2,
  damage: 1,
  health: 12,
}

export function createWaterCreature(grid: Vector2, rng: typeof RNG) {
  createCreature(grid, <Creature>(<unknown>rng.getWeightedValue({ [Creature.Alligator]: 2, [Creature.Fish]: 5 })), true)
}

export function createLandCreatures(playerSpawn: Vector2, rng: typeof RNG) {
  const openTiles = [...Level.data.values()].filter((t) => !t.solid)
  const landCreatureCount = Math.ceil(openTiles.length / rng.getUniformInt(600, 900))
  for (let i = 0; i < landCreatureCount; i++) {
    let tile: TileData
    do {
      tile = rng.getItem(openTiles)!
    } while (isWet(tile.type) || tile.solid || EntityMap.has(tile) || getDistance(tile, playerSpawn) < 12)
    createCreature(tile, Creature.GiantSnail)
  }
}

export function createTurtle(playerSpawn: Vector2, minimumDistance: number, rng: typeof RNG) {
  const openTiles = [...Level.data.values()].filter((t) => !t.solid)
  let tile: TileData
  do {
    tile = rng.getItem(openTiles)!
  } while (EntityMap.has(tile) || getDistance(tile, playerSpawn) < minimumDistance)
  createCreature(tile, Creature.Turtle, isWet(tile.type))
}

function createCreature(grid: Vector2, creatureType: Creature, spawnInWater = false) {
  const creature = addEntity(World)
  const creatureProps = CreatureProps[creatureType]
  const creatureSprite = new Sprite(getTexture(creatureProps.texture + (spawnInWater ? 'Swim' : '')))
  if (!ALL_VISIBLE) creatureSprite.alpha = 0
  addSprite(creature, creatureSprite)
  addComponent(World, NonPlayer, creature)
  addComponent(World, DisplayObject, creature)
  addComponent(World, OnTileType, creature)
  addComponent(World, GridPosition, creature)
  initEntGrid(creature, grid)
  if (creatureProps.wanderChance) {
    addComponent(World, Wander, creature)
    Wander.maxChance[creature] = creatureProps.wanderChance
    Wander.chance[creature] = RNG.getUniformInt(0, creatureProps.wanderChance)
  }
  if (creatureProps.canSwim) addComponent(World, CanSwim, creature)
  if (creatureProps.swimSlowness) CanSwim.slowness[creature] = creatureProps.swimSlowness
  if (creatureProps.canWalk) addComponent(World, CanWalk, creature)
  if (creatureProps.walkSlowness) CanWalk.slowness[creature] = creatureProps.walkSlowness
  if (creatureProps.senseRange) {
    addComponent(World, Predator, creature)
    Predator.lungeRange[creature] = creatureProps.lungeRange || 0
    Predator.senseRange[creature] = creatureProps.senseRange
    if (creatureProps.eatingTurns) Predator.eatingTurns[creature] = creatureProps.eatingTurns
  }
  if (creatureProps.damage) {
    addComponent(World, CanAttack, creature)
    CanAttack.damage[creature] = creatureProps.damage
  }
  if (creatureProps.health) {
    addComponent(World, Health, creature)
    Health.max[creature] = creatureProps.health
    Health.current[creature] = creatureProps.health
  }
  if (creatureProps.canSwim) {
    addComponent(World, WaterCreature, creature)
    WaterCreature.type[creature] = creatureType
  }
  addComponent(World, CalculateFOV, creature)
  if (creatureProps.spotting) {
    addComponent(World, Spotting, creature)
    Spotting.current[creature] = 0
    Spotting.increaseBy[creature] = creatureProps.spotting
  }
}
