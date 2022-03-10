import * as ROT from 'rot-js'
import { Sprite } from 'pixi.js'
import { addVector2, getDistance, getStraightLine, Vector2 } from './vector2'
import AStar from 'rot-js/lib/path/astar'
import { GridMap, isWalkable, isWet, Tile, TileMap } from './map'
import { RNG } from 'rot-js'
import { addSprite, createMapSprites, getTexture } from './sprites'
import { addComponent, addEntity } from 'bitecs'
import { World } from './ecs'
import {
  CalculateFOV,
  CanSwim,
  Chest,
  DisplayObject,
  Exit,
  Fish,
  GridPosition,
  Health,
  initEntGrid,
  OnTileType,
  Predator,
  Spotting,
  Wander,
} from './ecs/components'
import { OverlaySprites, promisedFrame } from './pixi'
import { showLevelGen } from './hud'

export const ALL_VISIBLE = 0
const seed = 1646937907724
const worldRNG = RNG.clone()
if (seed) worldRNG.setSeed(seed)
console.log('rng seed', worldRNG.getSeed())

const levelSizes = [
  [30, 30],
  [40, 40],
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
  const requiredFishCount = (mapWidth * mapHeight) / 180
  let attempts = 0
  let enterExitGrids
  let fishSpawns
  let chestSpawns
  while (true) {
    attempts++
    if (attempts > 500) throw 'Level generation failed!'
    await promisedFrame()
    showLevelGen(attempts)
    chestSpawns = generateMap()
    // TODO: Change chest spawns to look for tiles with many surrounding walls/waters in a 5x5 area? Sort by most secluded to least, cutoff at X number of open tiles
    enterExitGrids = getEnterExitGrids()
    if (!enterExitGrids) continue
    const ponds = getPonds()
    fishSpawns = getFishSpawns(ponds, enterExitGrids.enter)
    if (fishSpawns.size >= requiredFishCount) break
    console.log('too few fish', fishSpawns.size)
  }
  console.log('success after', attempts)
  createMapSprites(worldRNG)
  EntityMap = new GridMap()
  fishSpawns.forEach(createFish)
  chestSpawns.forEach(createChest)
  createExit(addVector2(enterExitGrids.enter, { x: 1, y: 0 }) /*enterExitGrids.exit*/)
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

  const chestSpawns: Vector2[] = []
  const holes = Level.getContiguousAreas((t) => t.type === Tile.Floor, 9)
  holes.forEach((hole) => {
    const newChest = worldRNG.getItem(hole)!
    if (!chestSpawns.some((c) => getDistance(c, newChest) < 16)) chestSpawns.push(newChest)
  })
  return chestSpawns
}

const between = (val: number, min: number, max: number) => val > min && val < max

function getEnterExitGrids(): { enter: Vector2; exit: Vector2 } | false {
  const outer = 4
  const inner = 10
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

function getFishSpawns(ponds: Vector2[][], player: Vector2): Set<Vector2> {
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

function createFish(grid: Vector2): boolean {
  const fish = addEntity(World)
  const fishSprite = new Sprite(getTexture('fishSwim'))
  if (!ALL_VISIBLE) fishSprite.alpha = 0
  addSprite(fish, fishSprite)
  addComponent(World, DisplayObject, fish)
  addComponent(World, OnTileType, fish)
  addComponent(World, GridPosition, fish)
  initEntGrid(fish, grid)
  addComponent(World, Wander, fish)
  Wander.maxChance[fish] = 10
  Wander.chance[fish] = worldRNG.getUniformInt(0, 10)
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

function createChest(grid: Vector2) {
  const chest = addEntity(World)
  const chestSprite = new Sprite(getTexture('chest'))
  if (!ALL_VISIBLE) chestSprite.alpha = 0
  addSprite(chest, chestSprite)
  addComponent(World, DisplayObject, chest)
  addComponent(World, GridPosition, chest)
  initEntGrid(chest, grid)
  addComponent(World, CalculateFOV, chest)
  addComponent(World, Chest, chest)
}

function createExit(grid: Vector2) {
  const exit = addEntity(World)
  const exitSprite = new Sprite(getTexture('exit'))
  exitSprite.anchor.y = 0.5
  if (!ALL_VISIBLE) exitSprite.alpha = 0
  addSprite(exit, exitSprite, OverlaySprites)
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
