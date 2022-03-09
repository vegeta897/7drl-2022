import * as ROT from 'rot-js'
import { Sprite } from 'pixi.js'
import { TILE_SIZE } from './'
import { EntitySprites, WorldSprites } from './pixi'
import { get8Neighbors, getDiamondAround, getDistance, Vector2 } from './vector2'
import AStar from 'rot-js/lib/path/astar'
import { GridMap, isWet, Tile, TileData, TileMap } from './map'
import { RNG } from 'rot-js'
import { getTexture, SpritesByEID } from './sprites'
import { addComponent, addEntity } from 'bitecs'
import { World } from './ecs'
import {
  CalculateFOV,
  CanSwim,
  DisplayObject,
  Fish,
  GridPosition,
  Health,
  OnTileType,
  Predator,
  setEntGrid,
  Spotting,
  Wander,
} from './ecs/components'

export const DEBUG_VISIBILITY = false
export const MAP_WIDTH = 80
export const MAP_HEIGHT = 80
const seed = 0
if (seed) RNG.setSeed(seed)
console.log('rng seed', RNG.getSeed())

const REQUIRED_FISH_COUNT = (MAP_WIDTH * MAP_HEIGHT) / 160

export let Level: TileMap
export let EntityMap: GridMap<number>

// TODO: Entity map doesn't allow more than one entity on a tile, this may cause issues!

// TODO: Generate map boundaries with another cellular with high probability to form a big blob

export let OpenFloors: Vector2[]

export function createLevel() {
  let fishSpawns
  do {
    generateMap()
    OpenFloors = []
    const ponds = getPonds()
    fishSpawns = getFishSpawns(ponds)
  } while (fishSpawns.size < REQUIRED_FISH_COUNT)
  createMapSprites()
  EntityMap = new GridMap()
  fishSpawns.forEach(createFish)
}

function generateMap() {
  const caves = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  caves.randomize(0.55)
  for (let i = 0; i < 2; i++) {
    caves.create()
  }
  Level = new TileMap()
  let c = 0
  caves.connect((x, y, value) => {
    c++
    const isBoundary = x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1
    Level.createTile({ x, y }, !isBoundary && value === 1 ? Tile.Floor : Tile.Wall)
  }, 1)
  const water = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  water.randomize(0.45)
  for (let i = 0; i < 3; i++) {
    water.create()
  }
  water.create((x, y, value) => {
    if (value === 0) return
    if (Level.get({ x, y }).type === Tile.Wall) return
    Level.createTile({ x, y }, Tile.Water)
  })
  Level.data.forEach((tile) => {
    if (tile.type !== Tile.Water) return
    let shallowAppeal = 0
    Level.get8Neighbors(tile)
      .map((n) => ({ ...n, d: getDistance(tile, n) }))
      .forEach((n) => {
        let tileAppeal = 0
        if (n.type === Tile.Wall) tileAppeal = 0.5
        if (n.type === Tile.Floor) tileAppeal = 1
        if (n.type === Tile.Shallows) tileAppeal = 1
        if (n.d > 1) tileAppeal /= 4
        shallowAppeal += tileAppeal
      })
    if (shallowAppeal / 6 > RNG.getUniform()) {
      Level.createTile(tile, Tile.Shallows)
    }
  })
}

function getPonds() {
  const ponds: Vector2[][] = []
  Level.data.forEach((tile) => {
    if (tile.type === Tile.Floor) {
      const diamond2 = getDiamondAround(tile, 2)
      if (diamond2.every((g) => Level.get(g).type === Tile.Floor)) {
        OpenFloors.push(tile)
      }
    } else if (isWet(tile.type)) {
      if (tile.pondIndex! >= 0) return
      const uncheckedNeighbors: Set<TileData> = new Set([tile])
      const pond: TileData[] = []
      let currentTile: TileData
      do {
        currentTile = [...uncheckedNeighbors.values()][0]
        uncheckedNeighbors.delete(currentTile)
        pond.push(currentTile)
        currentTile.pondIndex = ponds.length
        Level.get4Neighbors(currentTile).forEach((t) => t.pondIndex! < 0 && uncheckedNeighbors.add(t))
      } while (uncheckedNeighbors.size > 0)
      ponds.push(pond)
    }
  })
  return ponds
}

function getFishSpawns(ponds: Vector2[][]): Set<Vector2> {
  const spawns: Set<Vector2> = new Set()
  for (const pond of ponds) {
    const tilesPerFish = Math.max(7, RNG.getNormal(16, 6))
    const fishCount = Math.min(8, Math.floor(pond.length / tilesPerFish))
    for (let i = 0; i < fishCount; i++) {
      let randomPick
      do {
        randomPick = RNG.getItem(pond)!
      } while (spawns.has(randomPick))
      spawns.add(randomPick)
    }
  }
  return spawns
}

function createMapSprites() {
  const wallTexture = getTexture('wall')
  const floorTextures = ['floor1', 'floor2', 'floor3', 'floor4'].map((t) => getTexture(t))
  const waterTexture = getTexture('water')
  const shallowTexture = getTexture('waterReeds')
  const getTileTexture = (tile: Tile) => {
    switch (tile) {
      case Tile.Floor:
        return RNG.getItem(floorTextures)!
      case Tile.Wall:
        return wallTexture
      case Tile.Water:
        return waterTexture
      case Tile.Shallows:
        return shallowTexture
    }
  }
  Level.data.forEach((tile) => {
    tile.sprite = new Sprite(getTileTexture(tile.type))
    tile.sprite.x = tile.x * TILE_SIZE
    tile.sprite.y = tile.y * TILE_SIZE
    if (!DEBUG_VISIBILITY) tile.sprite.alpha = 0
    WorldSprites.addChild(tile.sprite)
  })
}

function createFish(grid: Vector2): boolean {
  const fish = addEntity(World)
  const fishSprite = new Sprite(getTexture('fishSwim'))
  if (!DEBUG_VISIBILITY) fishSprite.alpha = 0
  SpritesByEID[fish] = fishSprite
  EntitySprites.addChild(fishSprite)
  addComponent(World, DisplayObject, fish)
  addComponent(World, OnTileType, fish)
  addComponent(World, GridPosition, fish)
  setEntGrid(fish, grid)
  addComponent(World, Wander, fish)
  Wander.maxChance[fish] = 10
  Wander.chance[fish] = RNG.getUniformInt(0, 10)
  addComponent(World, CanSwim, fish)
  addComponent(World, Predator, fish)
  Predator.lungeRange[fish] = 4
  Predator.senseRange[fish] = 8
  addComponent(World, Health, fish)
  Health.max[fish] = 4
  Health.current[fish] = 4
  addComponent(World, Fish, fish)
  addComponent(World, CalculateFOV, fish)
  addComponent(World, Spotting, fish)
  Spotting.current[fish] = 0
  Spotting.increaseBy[fish] = 0.15
  return true
}

export function findPath(
  from: Vector2,
  to: Vector2,
  selfEntity: number,
  checkFn = (grid: Vector2) => !Level.get(grid).solid,
  distance = 1,
  maxNodes = 100
): Vector2[] {
  let nodesTried = 0
  const map = new AStar(
    to.x,
    to.y,
    (x, y) => {
      if (nodesTried++ > maxNodes) return false
      if (x === from.x && y === from.y) return true
      if (x === to.x && y === to.y) return true
      return checkFn({ x, y })
    },
    { topology: 4 }
  )
  const path: Vector2[] = []
  map.compute(from.x, from.y, (x, y) => (x !== from.x || y !== from.y) && path.length < distance && path.push({ x, y }))
  return path
}
