import * as ROT from 'rot-js'
import { Sprite } from 'pixi.js'
import { TILE_SIZE } from './'
import { EntitySprites, WorldSprites } from './pixi'
import { getDiamondAround, Vector2 } from './vector2'
import Dijkstra from 'rot-js/lib/path/dijkstra'
import { GridMap, Tile, TileData, TileMap } from './map'
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

export let Level: TileMap
export let EntityMap: GridMap<number>

// TODO: Entity map doesn't allow more than one entity on a tile, this may cause issues!

// TODO: Generate map boundaries with another cellular with high probability to form a big blob

export let OpenFloors: Vector2[]
let openWaters: Vector2[]
let ponds: Vector2[][]

export function createLevel() {
  EntityMap = new GridMap()

  const walls = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  walls.randomize(0.55)
  for (let i = 0; i < 2; i++) {
    walls.create()
  }
  Level = new TileMap()
  let c = 0
  walls.connect((x, y, value) => {
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

  const wallTexture = getTexture('wall')
  const floorTextures = ['floor1', 'floor2', 'floor3', 'floor4'].map((t) => getTexture(t))
  const waterTexture = getTexture('water')
  const getTileTexture = (tile: Tile) => {
    switch (tile) {
      case Tile.Floor:
        return RNG.getItem(floorTextures)!
      case Tile.Wall:
        return wallTexture
      case Tile.Water:
        return waterTexture
    }
  }
  OpenFloors = []
  openWaters = []
  ponds = []
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const grid = { x, y }
      const tile = Level.get(grid)
      tile.sprite = new Sprite(getTileTexture(tile.type))
      tile.sprite.x = x * TILE_SIZE
      tile.sprite.y = y * TILE_SIZE
      if (!DEBUG_VISIBILITY) tile.sprite.alpha = 0
      WorldSprites.addChild(tile.sprite)
      if (tile.type === Tile.Floor) {
        const diamond2 = getDiamondAround(grid, 2)
        if (diamond2.every((g) => Level.get(g).type === Tile.Floor)) {
          OpenFloors.push(grid)
        }
      } else if (tile.type === Tile.Water) {
        if (tile.pondIndex! >= 0) continue
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
        const tilesPerFish = Math.max(8, RNG.getNormal(24, 8))
        const fishCount = Math.floor(pond.length / tilesPerFish)
        for (let i = 0; i < fishCount; i++) {
          addFish(RNG.getItem(pond)!)
        }
        ponds.push(pond)
      }
    }
  }
}

function addFish(grid: Vector2) {
  if (EntityMap.has(grid)) return
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
}

export function findPath(
  from: Vector2,
  to: Vector2,
  selfEntity: number,
  checkFn = (grid: Vector2) => !Level.get(grid).solid,
  distance = 1
): Vector2[] {
  const map = new Dijkstra(
    to.x,
    to.y,
    (x, y) => {
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
