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
  Fish,
  Alligator,
  Turtle,
}

export const CreatureProps: {
  texture: string
  wanderChance: number
  canWalk: boolean
  senseRange?: number
  baitStunTurns?: number
  damage?: number
  health?: number
  spotting?: number
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
  wanderChance: 100,
  canWalk: true,
  senseRange: 6,
  baitStunTurns: 3,
  damage: 2,
  health: 6,
  spotting: 0.5,
}
CreatureProps[Creature.Turtle] = {
  texture: 'turtle',
  wanderChance: 400,
  canWalk: true,
}

export function createWaterCreature(grid: Vector2, rng: typeof RNG) {
  let creatureType = <Creature>(<unknown>rng.getWeightedValue({ [Creature.Alligator]: 1, [Creature.Fish]: 3 }))
  const creature = addEntity(World)
  const creatureProps = CreatureProps[creatureType]
  const creatureSprite = new Sprite(getTexture(creatureProps.texture + 'Swim'))
  if (!ALL_VISIBLE) creatureSprite.alpha = 0
  addSprite(creature, creatureSprite)
  addComponent(World, NonPlayer, creature)
  addComponent(World, DisplayObject, creature)
  addComponent(World, OnTileType, creature)
  addComponent(World, GridPosition, creature)
  initEntGrid(creature, grid)
  addComponent(World, Wander, creature)
  Wander.maxChance[creature] = creatureProps.wanderChance
  Wander.chance[creature] = rng.getUniformInt(0, creatureProps.wanderChance)
  addComponent(World, CanSwim, creature)
  if (creatureProps.canWalk) addComponent(World, CanWalk, creature)
  addComponent(World, Predator, creature)
  Predator.lungeRange[creature] = 4
  Predator.senseRange[creature] = creatureProps.senseRange!
  Predator.baitStunTurns[creature] = creatureProps.baitStunTurns!
  addComponent(World, CanAttack, creature)
  CanAttack.damage[creature] = creatureProps.damage!
  addComponent(World, Health, creature)
  Health.max[creature] = creatureProps.health!
  Health.current[creature] = creatureProps.health!
  addComponent(World, WaterCreature, creature)
  WaterCreature.type[creature] = creatureType
  addComponent(World, CalculateFOV, creature)
  addComponent(World, Spotting, creature)
  Spotting.current[creature] = 0
  Spotting.increaseBy[creature] = creatureProps.spotting!
}

export function createTurtle(playerSpawn: Vector2, minimumDistance: number, rng: typeof RNG) {
  const allOpenTiles = [...Level.data.values()]
  let turtleGrid: TileData
  do {
    turtleGrid = rng.getItem(allOpenTiles)!
  } while (turtleGrid.solid || EntityMap.has(turtleGrid) || getDistance(turtleGrid, playerSpawn) < minimumDistance)
  const turtle = addEntity(World)
  const turtleProps = CreatureProps[Creature.Turtle]
  let textureName = turtleProps.texture
  if (isWet(turtleGrid.type)) textureName += 'Swim'
  const turtleSprite = new Sprite(getTexture(textureName))
  if (!ALL_VISIBLE) turtleSprite.alpha = 0
  addSprite(turtle, turtleSprite)
  addComponent(World, NonPlayer, turtle)
  addComponent(World, DisplayObject, turtle)
  addComponent(World, OnTileType, turtle)
  addComponent(World, GridPosition, turtle)
  initEntGrid(turtle, turtleGrid)
  addComponent(World, Wander, turtle)
  Wander.maxChance[turtle] = turtleProps.wanderChance
  Wander.chance[turtle] = 0
  addComponent(World, CanSwim, turtle)
  addComponent(World, CanWalk, turtle)
  addComponent(World, WaterCreature, turtle)
  WaterCreature.type[turtle] = Creature.Turtle
  addComponent(World, CalculateFOV, turtle)
}
