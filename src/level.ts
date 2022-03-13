import * as ROT from 'rot-js'
import { RNG } from 'rot-js'
import { Sprite } from 'pixi.js'
import { addVector2, Down, getDistance, getStraightLine, Left, Right, Up, UpLeft, UpRight, Vector2 } from './vector2'
import AStar from 'rot-js/lib/path/astar'
import { GridMap, isWalkable, isWet, Tile, TileMap } from './map'
import { addSprite, createMapSprites, getTexture, SpritesByEID } from './sprites'
import { addComponent, addEntity, removeEntity } from 'bitecs'
import { World } from './ecs'
import {
  CalculateFOV,
  deleteEntGrid,
  DisplayObject,
  Exit,
  GridPosition,
  initEntGrid,
  Loot,
  Mushroom,
  NonPlayer,
} from './ecs/components'
import { OverlaySprites, promisedFrame, WorldSprites } from './pixi'
import { showLevelGen } from './hud'
import { createGiantSnails, createTurtle, createWaterCreature } from './creatures'
import { LootType } from './inventory'
import { setGameState } from './'

export const ALL_VISIBLE = 1
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

// Keep a list of known working seeds to fall back to when max attempts exceeded?

const waterCreatureCount: [number, number][] = [
  [8, 12],
  [12, 20],
  [20, 30],
]

export async function createLevel(levelNumber: number): Promise<Vector2> {
  ;[mapWidth, mapHeight] = levelSizes[levelNumber - 1]
  const minWaterCreatures = waterCreatureCount[levelNumber - 1][0]
  let attempts = 0
  let enterExitGrids
  let waterSpawns
  let lootSpawns
  let mushroomSpawns
  while (true) {
    attempts++
    if (attempts > 10000) {
      setGameState('LevelGenFailed')
      throw 'Level generation failed!'
    }
    showLevelGen(attempts)
    if (attempts % 10 === 0) await promisedFrame()
    ;({ lootSpawns, mushroomSpawns } = generateMap())
    if (lootSpawns.length < levelNumber * 8) {
      // console.log('too few loot spawns')
      continue
    }
    // TODO: Crawl map to find furthest tiles from spawn (for exit, or chests)
    enterExitGrids = getEnterExitGrids()
    // if (!enterExitGrids) console.log('no valid enter/exit')
    if (!enterExitGrids) continue
    const ponds = getPonds()
    waterSpawns = getWaterSpawns(ponds, enterExitGrids.enter)
    if (waterSpawns.length >= minWaterCreatures) break
    // console.log('too few water spawns', waterSpawns.length)
  }
  // console.log('success after', attempts)
  // console.log('water spawns', waterSpawns.length)
  Level.removeRedundantWalls()
  createMapSprites()
  EntityMap = new GridMap()
  const waterCreaturesToSpawn = Math.min(
    minWaterCreatures,
    worldRNG.getUniformInt(...waterCreatureCount[levelNumber - 1])
  )
  // console.log('water creature count', waterCreaturesToSpawn)
  waterSpawns.forEach((tile, i) => i < waterCreaturesToSpawn && createWaterCreature(tile, worldRNG))
  // console.log(lootSpawns.length, 'loot spawns')
  // console.log(mushroomSpawns.length, 'mushroom spawns')
  lootSpawns.forEach(
    (lootSpawn, i) => i < levelNumber * 8 && createLoot(lootSpawn, i < levelNumber * 2 ? LootType.Chest : LootType.Bag)
  )
  // for (let i = 0; i < 6; i++) {
  //   createLoot(
  //     { x: enterExitGrids.enter.x - 1 + (i % 3), y: enterExitGrids.enter.y + (i < 3 ? -1 : 1) },
  //     LootType.Chest
  //   )
  // }
  mushroomSpawns.forEach(createMushroom)
  createTurtle(enterExitGrids.enter, mapWidth / 2, worldRNG)
  createGiantSnails(enterExitGrids.enter, worldRNG)
  createExit(enterExitGrids.exit)
  return enterExitGrids.enter
}

function generateMap(): { lootSpawns: Vector2[]; mushroomSpawns: Vector2[] } {
  Level = new TileMap(mapWidth, mapHeight)
  const caves = new ROT.Map.Cellular(mapWidth, mapHeight)
  RNG.setState(worldRNG.getState()) // Because rot.js maps use the global RNG
  caves.randomize(0.5)
  for (let i = 0; i < 2; i++) {
    caves.create()
  }
  // let longestConnection = 0
  caves.connect(
    () => {},
    1,
    (from, to) => {
      // let distance = Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1])
      // longestConnection = Math.max(longestConnection, distance)
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
  // Create water pools
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
      if (Level.get4Neighbors(tile).every((n) => n.type === Tile.Wall)) return
      if (Level.get8Neighbors(tile).some((n) => n.type === Tile.Path)) return
      if (worldRNG.getUniform() > 0.9) Level.createTile(tile, Tile.Stalagmite)
    } else if (tile.type === Tile.Floor) {
      if (Level.get8Neighbors(tile).some((n) => n.solid)) return
      if (worldRNG.getUniform() > 0.9) Level.createTile(tile, Tile.Stalagmite)
    }
  })
  // Pick loot spawns
  const lootSpawns: Vector2[] = []
  const rooms = [...Level.data.values()].filter(
    (tile) => tile.type === Tile.Path && Level.get8Neighbors(tile).filter((n) => n.type === Tile.Path).length >= 3
  )
  rooms.forEach((centerRoomTile) => {
    if (!lootSpawns.some((c) => getDistance(c, centerRoomTile) < 8)) lootSpawns.push(centerRoomTile)
  })
  const isolatedFloors = Level.getContiguousAreas((t) => t.type === Tile.Floor, 20)
  isolatedFloors.forEach((hole) => {
    const newLoot = worldRNG.getItem(hole)!
    if (lootSpawns.some((c) => getDistance(c, newLoot) < 4)) return
    lootSpawns.push(newLoot)
  })
  // Pick mushroom spawns
  const mushroomSpawns: Vector2[] = []
  Level.data.forEach((tile) => {
    if (tile.type !== Tile.Floor) return
    if (
      !mushroomSpawns.some((c) => getDistance(c, tile) < 4) &&
      Level.get8Neighbors(tile).filter((n) => n.solid).length >= 6
    )
      mushroomSpawns.push(tile)
  })
  return { lootSpawns, mushroomSpawns }
}

const between = (val: number, min: number, max: number) => val > min && val < max

function getEnterExitGrids(): { enter: Vector2; exit: Vector2 } | false {
  const outer = 1
  const inner = 12
  const validSpawns: Vector2[] = []
  const validExits: Vector2[] = []
  Level.data.forEach((tile) => {
    if (isWet(tile.type) || !isWalkable(tile.type)) return
    if (!between(tile.x, outer, inner) && !between(tile.x, mapWidth - inner, mapWidth - outer)) return
    if (!between(tile.y, outer, inner) && !between(tile.y, mapHeight - inner, mapHeight - outer)) return
    if (Level.getSquareAround(tile, 1).every((t) => isWalkable(t.type))) validSpawns.push(tile)
    if (
      [
        addVector2(tile, Up),
        addVector2(addVector2(tile, Up), Up),
        addVector2(tile, UpLeft),
        addVector2(tile, UpRight),
      ].every((n) => Level.get(n).type === Tile.Wall) &&
      [addVector2(tile, Down), addVector2(tile, Left), addVector2(tile, Right)].every((n) => !Level.get(n).solid)
    ) {
      validExits.push(tile)
    }
  })
  if (validSpawns.length === 0) return false
  if (validExits.length === 0) return false
  const enter = worldRNG.shuffle(validSpawns)[0]
  let exit
  for (let i = 1; i < validExits.length; i++) {
    exit = validExits[i]
    if (getDistance(enter, exit) > Math.max(mapWidth, mapHeight)) return { enter, exit }
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

function getWaterSpawns(ponds: Vector2[][], player: Vector2): Vector2[] {
  const spawns: Set<Vector2> = new Set()
  for (const pond of ponds) {
    const tilesPerFish = Math.max(6, worldRNG.getNormal(12, 3))
    const fishCount = Math.min(4, Math.floor(pond.length / tilesPerFish))
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
  return [...spawns]
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

function createMushroom(grid: Vector2) {
  if (EntityMap.has(grid)) return
  const mushroom = addEntity(World)
  const lootSprite = new Sprite(getTexture('mushroom'))
  if (!ALL_VISIBLE) lootSprite.alpha = 0
  addSprite(mushroom, lootSprite, WorldSprites)
  addComponent(World, NonPlayer, mushroom)
  addComponent(World, DisplayObject, mushroom)
  addComponent(World, GridPosition, mushroom)
  initEntGrid(mushroom, grid)
  addComponent(World, CalculateFOV, mushroom)
  addComponent(World, Mushroom, mushroom)
}

function createExit(grid: Vector2) {
  const entityHere = EntityMap.get(grid)
  if (entityHere) {
    SpritesByEID[entityHere].destroy()
    delete SpritesByEID[entityHere]
    deleteEntGrid(entityHere)
    removeEntity(World, entityHere)
  }
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
