import { getDistance, Vector2 } from './vector2'
import { World } from './ecs'
import { AnimatedSprite } from 'pixi.js'
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
  SeekWater,
  Snail,
  Spotting,
  Wander,
  WaterCreature,
} from './ecs/components'
import { ALL_VISIBLE, EntityMap, Level } from './level'
import { addComponent, addEntity, hasComponent } from 'bitecs'
import { RNG } from 'rot-js'
import { isWet, TileData } from './map'
import { CurrentLevel } from './'

export enum Creature {
  Fish = 1,
  Alligator,
  Turtle,
  GiantSnail,
  Crayfish,
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
  maxAdditionalDamage?: number
  health?: [number, number]
  spotting?: number
  killPoints: number
  seekWater?: number
}[] = []
CreatureProps[Creature.Fish] = {
  texture: 'fish',
  name: 'jumbo piranha',
  wanderChance: 10,
  canSwim: true,
  senseRange: 8,
  lungeRange: 4,
  eatingTurns: 5,
  damage: 1,
  maxAdditionalDamage: 1,
  health: [4, 6],
  spotting: 0.15,
  killPoints: 25,
}
CreatureProps[Creature.Crayfish] = {
  texture: 'crayfish',
  name: 'killer crayfish',
  wanderChance: 20,
  canSwim: true,
  canWalk: true,
  swimSlowness: 1,
  walkSlowness: 1,
  senseRange: 8,
  lungeRange: 2,
  eatingTurns: 4,
  damage: 1,
  maxAdditionalDamage: 1,
  health: [6, 8],
  spotting: 0.2,
  killPoints: 30,
  seekWater: 8,
}
CreatureProps[Creature.Alligator] = {
  texture: 'alligator',
  wanderChance: 100,
  canWalk: true,
  canSwim: true,
  swimSlowness: 1,
  senseRange: 6,
  lungeRange: 3,
  eatingTurns: 2,
  damage: 2,
  maxAdditionalDamage: 2,
  health: [7, 9],
  spotting: 0.5,
  killPoints: 40,
  seekWater: 8,
}
CreatureProps[Creature.Turtle] = {
  texture: 'turtle',
  wanderChance: 400,
  canWalk: true,
  canSwim: true,
  killPoints: 0,
}
CreatureProps[Creature.GiantSnail] = {
  texture: 'giantSnail',
  name: 'giant snail',
  wanderChance: 300,
  canWalk: true,
  walkSlowness: 2,
  senseRange: 4,
  damage: 1,
  maxAdditionalDamage: 2,
  health: [14, 18],
  killPoints: 60,
}

export function createWaterCreature(grid: Vector2, rng: typeof RNG) {
  createCreature(
    grid,
    <Creature>(<unknown>rng.getWeightedValue({ [Creature.Alligator]: 2, [Creature.Fish]: 5, [Creature.Crayfish]: 3 })),
    true
  )
}

export function createGiantSnails(playerSpawn: Vector2, rng: typeof RNG) {
  const openTiles = [...Level.data.values()].filter((t) => !t.solid)
  const snailCount = rng.getUniformInt(
    ...(<[number, number]>[
      [1, 2],
      [2, 5],
      [4, 8],
    ][CurrentLevel - 1])
  )
  for (let i = 0; i < snailCount; i++) {
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
  const creatureSprite = changeAnimation(null, creatureType, spawnInWater)
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
    CanAttack.maxAdditional[creature] = creatureProps.maxAdditionalDamage!
  }
  if (creatureProps.health) {
    addComponent(World, Health, creature)
    const health = RNG.getUniformInt(...creatureProps.health)
    Health.max[creature] = health
    Health.current[creature] = health
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
  if (creatureType === Creature.GiantSnail) addComponent(World, Snail, creature)
  if (creatureProps.seekWater) {
    addComponent(World, SeekWater, creature)
    SeekWater.distance[creature] = creatureProps.seekWater
  }
}

export function changeAnimation(sprite: AnimatedSprite | null, creatureType: Creature, swim = false): AnimatedSprite {
  const creatureProps = CreatureProps[creatureType]
  const textures = swim
    ? [1, 2, 3].map((n) => ({ texture: getTexture(creatureProps.texture + 'Swim' + n), time: 400 }))
    : [getTexture(creatureProps.texture)]
  if (sprite === null) {
    sprite = new AnimatedSprite(textures)
  } else {
    sprite.textures = textures
  }
  if (!sprite.playing) sprite.play()
  return sprite
}

export function getCreatureKillPoints(eid: number): number {
  if (hasComponent(World, Snail, eid)) return CreatureProps[Creature.GiantSnail].killPoints
  else if (hasComponent(World, WaterCreature, eid)) return CreatureProps[WaterCreature.type[eid]].killPoints
  return 0
}
