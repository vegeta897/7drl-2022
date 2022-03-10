import * as ROT from 'rot-js'
import { Sprite } from 'pixi.js'
import { getDistance, getStraightLine, Vector2 } from './vector2'
import AStar from 'rot-js/lib/path/astar'
import { GridMap, isWalkable, isWet, Tile, TileData, TileMap } from './map'
import { RNG } from 'rot-js'
import { addSprite, createMapSprites, getTexture } from './sprites'
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

export const DEBUG_VISIBILITY = true
export const MAP_WIDTH = 80
export const MAP_HEIGHT = 80
const seed = 0
if (seed) RNG.setSeed(seed)
console.log('rng seed', RNG.getSeed())

const REQUIRED_FISH_COUNT = (MAP_WIDTH * MAP_HEIGHT) / 170

export let Level: TileMap
export let EntityMap: GridMap<number>

// TODO: Entity map doesn't allow more than one entity on a tile, this may cause issues!

export function createLevel(): Vector2 {
  let attempts = 0
  let playerSpawn
  let fishSpawns
  while (true) {
    attempts++
    if (attempts > 50) throw 'Level generation failed!'
    console.log('attempt', attempts)
    generateMap()
    console.log('getting player spawn')
    playerSpawn = getPlayerSpawn()
    if (!playerSpawn) continue
    const ponds = getPonds()
    console.log('getting fish spawns')
    fishSpawns = getFishSpawns(ponds, playerSpawn)
    if (fishSpawns.size >= REQUIRED_FISH_COUNT) break
    console.log('too few fish', fishSpawns.size)
  }
  console.log('success after', attempts)
  createMapSprites()
  EntityMap = new GridMap()
  fishSpawns.forEach(createFish)
  return playerSpawn
}

function generateMap() {
  Level = new TileMap(MAP_WIDTH, MAP_HEIGHT)
  const caves = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  caves.randomize(0.5)
  for (let i = 0; i < 2; i++) {
    caves.create()
  }
  let longestConnection = 0
  caves.connect(
    () => {},
    1,
    (from, to) => {
      let distance = Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1])
      longestConnection = Math.max(longestConnection, distance)
      getStraightLine({ x: from[0], y: from[1] }, { x: to[0], y: to[1] }).forEach(({ x, y }) => {
        caves.set(x, y, 2)
      })
    }
  )
  console.log('longest tunnel', longestConnection)
  Level.loadRotJSMap(<(0 | 1)[][]>caves._map)

  const holes = Level.getContiguousAreas((t) => t.type === Tile.Floor, 9)
  console.log(holes.map((h) => h.length))

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
        if (n.type === Tile.Path) tileAppeal = -0.5
        if (n.type === Tile.Shallows) tileAppeal = 1
        if (n.d > 1) tileAppeal /= 4
        shallowAppeal += tileAppeal
      })
    if (shallowAppeal / 6 > RNG.getUniform()) {
      Level.createTile(tile, Tile.Shallows)
    }
  })
}

const between = (val: number, min: number, max: number) => val > min && val < max

function getPlayerSpawn(): Vector2 | false {
  const outer = 5
  const inner = 15
  const validSpawns: Vector2[] = []
  Level.data.forEach((tile) => {
    if (!isWalkable(tile.type)) return
    if (!between(tile.x, outer, inner) && !between(tile.x, MAP_WIDTH - inner, MAP_WIDTH - outer)) return
    if (!between(tile.y, outer, inner) && !between(tile.y, MAP_HEIGHT - inner, MAP_HEIGHT - outer)) return
    if (Level.getDiamondAround(tile, 2).every((t) => isWalkable(t.type))) validSpawns.push(tile)
  })
  if (validSpawns.length === 0) return false
  return RNG.getItem(validSpawns)!
}

function getPonds() {
  return Level.getContiguousAreas((t) => isWet(t.type)).filter((pond) => {
    if (pond.length === 1) {
      pond.forEach((p) => Level.createTile(p, Tile.Floor))
      return false
    }
    return true
  })
}

function getFishSpawns(ponds: Vector2[][], player: Vector2): Set<Vector2> {
  const spawns: Set<Vector2> = new Set()
  for (const pond of ponds) {
    const tilesPerFish = Math.max(7, RNG.getNormal(16, 6))
    const fishCount = Math.min(8, Math.floor(pond.length / tilesPerFish))
    let spawnCandidate = [...pond]
    for (let i = 0; i < fishCount; i++) {
      let randomPick
      do {
        randomPick = RNG.getItem(spawnCandidate)!
        spawnCandidate.splice(spawnCandidate.indexOf(randomPick), 1)
      } while (spawnCandidate.length > 0 && getDistance(randomPick, player) < 10)
      spawns.add(randomPick)
    }
  }
  return spawns
}

function createFish(grid: Vector2): boolean {
  const fish = addEntity(World)
  const fishSprite = new Sprite(getTexture('fishSwim'))
  if (!DEBUG_VISIBILITY) fishSprite.alpha = 0
  addSprite(fish, fishSprite)
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
