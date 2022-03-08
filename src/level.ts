import * as ROT from 'rot-js'
import { Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from './'
import { WorldSprites } from './pixi'
import { getDiamondAround, getSquareAround, Vector2 } from './vector2'
import Dijkstra from 'rot-js/lib/path/dijkstra'
import { GridMap } from './map'
import { RNG } from 'rot-js'

const MAP_WIDTH = 80
const MAP_HEIGHT = 80

export let Level: GridMap<Tile, Tile>
export let EntityMap: GridMap<number>

export let OpenFloors: Vector2[] = []
export let OpenWaters: Vector2[] = []

export function createLevel() {
  EntityMap = new GridMap()

  const walls = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  walls.randomize(0.5)
  for (let i = 0; i < 2; i++) {
    walls.create()
  }
  Level = new GridMap(Tile.Floor)
  walls.connect((x, y, value) => {
    const isBoundary = x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1
    const tileType = !isBoundary && value === 1 ? Tile.Floor : Tile.Wall
    Level.set({ x, y }, tileType)
  }, 1)
  const water = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  water.randomize(0.45)
  for (let i = 0; i < 3; i++) {
    water.create()
  }
  water.create((x, y, value) => {
    if (value === 0) return
    if (Level.get({ x, y }) === Tile.Wall) return
    Level.set({ x, y }, Tile.Water)
  })

  const wallTexture = Texture.from('wall')
  const floorTextures = ['floor1', 'floor2', 'floor3', 'floor4'].map((t) => Texture.from(t))
  const waterTexture = Texture.from('water')
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
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const tileType = Level.get({ x, y })
      const tileSprite = new Sprite(getTileTexture(tileType))
      tileSprite.x = x * TILE_SIZE
      tileSprite.y = y * TILE_SIZE
      WorldSprites.addChild(tileSprite)
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
