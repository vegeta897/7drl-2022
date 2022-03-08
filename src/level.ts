import * as ROT from 'rot-js'
import { Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from './'
import { WorldSprites } from './pixi'
import { getDiamondAround, getSquareAround, Vector2 } from './vector2'
import Dijkstra from 'rot-js/lib/path/dijkstra'
import { GridMap, Tile, TileMap } from './map'
import { RNG } from 'rot-js'

const MAP_WIDTH = 80
const MAP_HEIGHT = 80

export let Level: TileMap
export let EntityMap: GridMap<number>

export let OpenFloors: Vector2[]
export let OpenWaters: Vector2[]

export function createLevel() {
  EntityMap = new GridMap()

  const walls = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  walls.randomize(0.5)
  for (let i = 0; i < 2; i++) {
    walls.create()
  }
  Level = new TileMap()
  walls.connect((x, y, value) => {
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
  OpenFloors = []
  OpenWaters = []
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const tile = Level.get({ x, y })
      tile.sprite = new Sprite(getTileTexture(tile.type))
      tile.sprite.x = x * TILE_SIZE
      tile.sprite.y = y * TILE_SIZE
      tile.sprite.alpha = 0
      WorldSprites.addChild(tile.sprite)
      const diamond2 = getDiamondAround({ x, y }, 2)
      if (diamond2.every((g) => Level.get(g).type === Tile.Floor)) {
        OpenFloors.push({ x, y })
      }
      const square3x3 = getSquareAround({ x, y }, 1)
      if (square3x3.every((g) => Level.get(g).type === Tile.Water)) {
        OpenWaters.push({ x, y })
      }
    }
  }
}

export function findPath(from: Vector2, to: Vector2, selfEntity: number, distance = 1): Vector2[] {
  const map = new Dijkstra(
    to.x,
    to.y,
    (x, y) => {
      if (x === from.x && y === from.y) return true
      return !Level.get({ x, y }).solid && !EntityMap.has({ x, y })
    },
    { topology: 4 }
  )
  const path: Vector2[] = []
  map.compute(from.x, from.y, (x, y) => (x !== from.x || y !== from.y) && path.length < distance && path.push({ x, y }))
  return path
}
