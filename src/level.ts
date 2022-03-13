import * as ROT from 'rot-js'
import { RNG } from 'rot-js'
import { Sprite } from 'pixi.js'
import { getDistance, getStraightLine, Vector2 } from './vector2'
import AStar from 'rot-js/lib/path/astar'
import { GridMap, isWalkable, isWet, Tile, TileMap } from './map'
import { addSprite, createMapSprites, getTexture } from './sprites'
import { addComponent, addEntity } from 'bitecs'
import { World } from './ecs'
import { CalculateFOV, DisplayObject, Exit, GridPosition, initEntGrid, Loot, NonPlayer } from './ecs/components'
import { OverlaySprites, promisedFrame, WorldSprites } from './pixi'
import { showLevelGen } from './hud'
import { createLandCreatures, createTurtle, createWaterCreature } from './creatures'
import { LootType } from './inventory'
import { CurrentLevel, setGameState } from './index'

export const ALL_VISIBLE = 0
const seed = 0
const worldRNG = RNG.clone()
worldRNG.setSeed(seed || RNG.getSeed())
console.log('rng seed', worldRNG.getSeed())

const levelSizes = [
  [40, 40],
  [50, 50],
  [60, 60],
]
let mapWidth: number
let mapHeight: number

export let Level: TileMap
export let EntityMap: GridMap<number>

// Keep a list of known working seeds to fall back to when max attempts exceeded

// TODO: Entity map doesn't allow more than one entity on a tile, this may cause issues!

export async function createLevel(levelNumber: number): Promise<Vector2> {
  ;[mapWidth, mapHeight] = levelSizes[levelNumber - 1]
  const minWaterCreatures = (mapWidth * mapHeight) / 180
  let attempts = 0
  let enterExitGrids
  let waterSpawns
  let lootSpawns
  while (true) {
    attempts++
    if (attempts > 10000) {
      setGameState('LevelGenFailed')
      throw 'Level generation failed!'
    }
    showLevelGen(attempts)
    if (attempts % 10 === 0) await promisedFrame()
    lootSpawns = generateMap()
    // TODO: Change chest spawns to look for tiles with many surrounding walls/waters in a 5x5 area? Sort by most secluded to least, cutoff at X number of open tiles

    // TODO: Crawl map to find furthest tiles from spawn (for exit, or chests)

    enterExitGrids = getEnterExitGrids()
    if (!enterExitGrids) continue
    const ponds = getPonds()
    waterSpawns = getWaterSpawns(ponds, enterExitGrids.enter)
    if (waterSpawns.size >= minWaterCreatures) break
    console.log('too few water creatures', waterSpawns.size)
  }
  console.log('success after', attempts)
  Level.removeRedundantWalls()
  createMapSprites()
  EntityMap = new GridMap()
  waterSpawns.forEach((tile) => createWaterCreature(tile, worldRNG))
  lootSpawns.forEach((lootSpawn, i) => createLoot(lootSpawn, i < CurrentLevel * 2 ? LootType.Chest : LootType.Bag))
  for (let i = 0; i < 6; i++) {
    createLoot(
      { x: enterExitGrids.enter.x - 1 + (i % 3), y: enterExitGrids.enter.y + (i < 3 ? -1 : 1) },
      LootType.Chest
    )
  }
  createTurtle(enterExitGrids.enter, mapWidth / 2, worldRNG)
  createLandCreatures(enterExitGrids.enter, worldRNG)
  createExit(enterExitGrids.exit)
  return enterExitGrids.enter
}

function generateMap(): Vector2[] {
  Level = new TileMap(mapWidth, mapHeight)
  const caves = new ROT.Map.Cellular(mapWidth, mapHeight)
  RNG.setState(worldRNG.getState()) // Because rot.js maps use the global RNG
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
  worldRNG.setState(RNG.getState())
  // console.log('longest tunnel', longestConnection)
  Level.loadRotJSMap(<(0 | 1)[][]>caves._map)

  // Connect path gaps
  let pathsAdded: number
  do {
    pathsAdded = 0
    Level.data.forEach((tile) => {
      if (tile.type !== Tile.Floor) return
      if (Level.get4Neighbors(tile).filter((n) => n.type === Tile.Path).length > 1) {
        pathsAdded++
        Level.createTile(tile, Tile.Path)
      }
    })
  } while (pathsAdded > 0)

  const water = new ROT.Map.Cellular(mapWidth, mapHeight)
  RNG.setState(worldRNG.getState()) // Because rot.js maps use the global RNG
  water.randomize(0.45)
  worldRNG.setState(RNG.getState())
  for (let i = 0; i < 3; i++) {
    water.create()
  }
  water.create((x, y, value) => {
    if (value === 0) return
    if (Level.get({ x, y }).type === Tile.Wall) return
    Level.createTile({ x, y }, Tile.Water)
  })
  // Create shallows
  Level.data.forEach((tile) => {
    if (tile.type !== Tile.Water) return
    let shallowAppeal = 0
    Level.get8Neighbors(tile)
      .map((n) => ({ ...n, d: getDistance(tile, n) }))
      .forEach((n) => {
        let shallowFactor = 0
        if (n.type === Tile.Wall) shallowFactor = 0.5
        if (n.type === Tile.Floor) shallowFactor = 1
        if (n.type === Tile.Path) shallowFactor = -0.5
        if (n.type === Tile.Shallows) shallowFactor = 1
        if (n.d > 1) shallowFactor /= 4
        shallowAppeal += shallowFactor
      })
    if (shallowAppeal / 6 > worldRNG.getUniform()) {
      Level.createTile(tile, Tile.Shallows)
    }
  })

  // Create stalactites
  Level.data.forEach((tile) => {
    if (tile.type === Tile.Wall) {
      if (Level.isOutOfBounds(tile)) return
      const neighbors4 = Level.get4Neighbors(tile)
      if (neighbors4.every((n) => n.type === Tile.Wall)) return
      if (worldRNG.getUniform() > 0.9) Level.createTile(tile, Tile.Stalagmite)
    } else if (tile.type === Tile.Floor) {
      const neighbors8 = Level.get8Neighbors(tile)
      if (neighbors8.some((n) => n.solid)) return
      if (worldRNG.getUniform() > 0.9) Level.createTile(tile, Tile.Stalagmite)
    }
  })

  const lootSpawns: Vector2[] = []
  const rooms = [...Level.data.values()].filter(
    (tile) => tile.type === Tile.Path && Level.get8Neighbors(tile).filter((n) => n.type === Tile.Path).length >= 4
  )
  rooms.forEach((centerRoomTile) => {
    if (!lootSpawns.some((c) => getDistance(c, centerRoomTile) < 16)) lootSpawns.push(centerRoomTile)
  })
  const holes = Level.getContiguousAreas((t) => t.type === Tile.Floor, 9)
  holes.forEach((hole) => {
    const newLoot = worldRNG.getItem(hole)!
    if (Level.get4Neighbors(newLoot).some((t) => isWet(t.type))) return
    if (lootSpawns.some((c) => getDistance(c, newLoot) < 16)) return
    lootSpawns.push(newLoot)
  })
  return lootSpawns
}

const between = (val: number, min: number, max: number) => val > min && val < max

function getEnterExitGrids(): { enter: Vector2; exit: Vector2 } | false {
  const outer = 3
  const inner = 12
  const validSpawns: Vector2[] = []
  Level.data.forEach((tile) => {
    if (!isWalkable(tile.type)) return
    if (!between(tile.x, outer, inner) && !between(tile.x, mapWidth - inner, mapWidth - outer)) return
    if (!between(tile.y, outer, inner) && !between(tile.y, mapHeight - inner, mapHeight - outer)) return
    if (Level.getDiamondAround(tile, 2).every((t) => isWalkable(t.type))) validSpawns.push(tile)
  })
  if (validSpawns.length < 2) return false
  worldRNG.shuffle(validSpawns)
  let enter
  let exit
  for (let i = 0; i < validSpawns.length; i++) {
    enter = validSpawns[i]
    for (let ii = i + 1; ii < validSpawns.length; ii++) {
      exit = validSpawns[ii]
      if (getDistance(enter, exit) > Math.max(mapWidth, mapHeight)) {
        return { enter, exit }
      }
    }
  }
  return false
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

function getWaterSpawns(ponds: Vector2[][], player: Vector2): Set<Vector2> {
  const spawns: Set<Vector2> = new Set()
  for (const pond of ponds) {
    const tilesPerFish = Math.max(7, worldRNG.getNormal(16, 5))
    const fishCount = Math.min(8, Math.floor(pond.length / tilesPerFish))
    let spawnCandidate = [...pond]
    for (let i = 0; i < fishCount; i++) {
      let randomPick
      do {
        randomPick = worldRNG.getItem(spawnCandidate)!
        spawnCandidate.splice(spawnCandidate.indexOf(randomPick), 1)
      } while (spawnCandidate.length > 0 && getDistance(randomPick, player) < 10)
      if (randomPick) spawns.add(randomPick)
    }
  }
  return spawns
}

function createLoot(grid: Vector2, type: LootType) {
  const loot = addEntity(World)
  const lootSprite = new Sprite(getTexture(type === LootType.Chest ? 'chest' : 'bag'))
  if (!ALL_VISIBLE) lootSprite.alpha = 0
  addSprite(loot, lootSprite, WorldSprites)
  addComponent(World, NonPlayer, loot)
  addComponent(World, DisplayObject, loot)
  addComponent(World, GridPosition, loot)
  initEntGrid(loot, grid)
  addComponent(World, CalculateFOV, loot)
  addComponent(World, Loot, loot)
  Loot.type[loot] = type
}

function createExit(grid: Vector2) {
  const exit = addEntity(World)
  const exitSprite = new Sprite(getTexture('exit'))
  exitSprite.anchor.x = 0.25
  exitSprite.anchor.y = 0.5
  if (!ALL_VISIBLE) exitSprite.alpha = 0
  addSprite(exit, exitSprite, OverlaySprites)
  addComponent(World, NonPlayer, exit)
  addComponent(World, DisplayObject, exit)
  addComponent(World, GridPosition, exit)
  initEntGrid(exit, grid)
  addComponent(World, CalculateFOV, exit)
  addComponent(World, Exit, exit)
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
