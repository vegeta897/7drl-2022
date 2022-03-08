import * as ROT from 'rot-js'
import { Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from './'
import { WorldSprites } from './pixi'
import { getDiamondAround, getSquareAround, Vector2 } from './vector2'
import Dijkstra from 'rot-js/lib/path/dijkstra'
import { GridMap } from './map'

const MAP_WIDTH = 80
const MAP_HEIGHT = 80

export let Level: GridMap<Tile, Tile>
export let EntityMap: GridMap<number>

export let OpenFloors: Vector2[] = []
export let OpenWaters: Vector2[] = []

export function createLevel() {
  const walls = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  walls.randomize(0.5)
  for (let i = 0; i < 2; i++) {
    walls.create()
  }
  Level = new GridMap(Tile.Floor)
  EntityMap = new GridMap()
  const wallTexture = Texture.from('wall')
  walls.connect((x, y, value) => {
    const isBoundary = x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1
    if (!isBoundary && value === 1) return
    Level.set({ x, y }, Tile.Wall)
    const wallSprite = new Sprite(wallTexture)
    wallSprite.x = x * TILE_SIZE
    wallSprite.y = y * TILE_SIZE
    WorldSprites.addChild(wallSprite)
  }, 1)
  const water = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  water.randomize(0.45)
  const waterTexture = Texture.from('water')
  for (let i = 0; i < 3; i++) {
    water.create()
  }
  water.create((x, y, value) => {
    if (value === 0) return
    if (Level.has({ x, y })) return
    Level.set({ x, y }, Tile.Water)
    const waterSprite = new Sprite(waterTexture)
    waterSprite.x = x * TILE_SIZE
    waterSprite.y = y * TILE_SIZE
    WorldSprites.addChild(waterSprite)
  })
  for (let x = 2; x < MAP_WIDTH - 3; x++) {
    for (let y = 2; y < MAP_HEIGHT - 3; y++) {
      const diamond2 = getDiamondAround({ x, y }, 2)
      if (diamond2.every((g) => !Level.get(g))) {
        OpenFloors.push({ x, y })
      }
      const square3x3 = getSquareAround({ x, y }, 1)
      if (square3x3.every((g) => Level.get(g) === Tile.Water)) {
        OpenWaters.push({ x, y })
      }
    }
  }
}

export enum Tile {
  Floor,
  Wall,
  Water,
}

export type TileData = {
  sprite?: Sprite
  x: number
  y: number
  type: Tile
  seeThrough: boolean
  solid: boolean
  tint?: number
  ignoreFOV?: boolean
  revealed: number
}

export function findPath(from: Vector2, to: Vector2, selfEntity: number, distance = 1): Vector2[] {
  const map = new Dijkstra(
    to.x,
    to.y,
    (x, y) => {
      if (x === from.x && y === from.y) return true
      return Level.get({ x, y }) !== Tile.Wall && !EntityMap.has({ x, y })
    },
    { topology: 4 }
  )
  const path: Vector2[] = []
  map.compute(from.x, from.y, (x, y) => (x !== from.x || y !== from.y) && path.length < distance && path.push({ x, y }))
  return path
}
