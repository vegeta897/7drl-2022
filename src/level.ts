import * as ROT from 'rot-js'
import { Sprite, Texture } from 'pixi.js'
import { TILE_SIZE } from './'
import { PixiViewport } from './pixi'
import { getDiamondAround, Vector2 } from './vector2'

const MAP_WIDTH = 80
const MAP_HEIGHT = 40

export let Level: Map<string, Tile>

export let OpenAreas: Vector2[] = []

export function createLevel() {
  const cellular = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT)
  cellular.randomize(0.5)
  for (let i = 0; i < 2; i++) {
    cellular.create()
  }
  Level = new Map()
  const wallTexture = Texture.from('wall')
  cellular.connect((x, y, value) => {
    const isBoundary = x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1
    if (!isBoundary && value === 1) return
    Level.set(TileMap.keyFromXY(x, y), Tile.Wall)
    const wallSprite = new Sprite(wallTexture)
    wallSprite.x = x * TILE_SIZE
    wallSprite.y = y * TILE_SIZE
    PixiViewport.addChild(wallSprite)
  }, 1)
  for (let x = 2; x < MAP_WIDTH - 3; x++) {
    for (let y = 2; y < MAP_HEIGHT - 3; y++) {
      const diamond = getDiamondAround({ x, y }, 2)
      if (diamond.every((g) => !Level.get(TileMap.keyFromXY(g.x, g.y)))) {
        OpenAreas.push({ x, y })
      }
    }
  }
}

export enum Tile {
  Floor,
  Wall,
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

export class TileMap {
  data: Map<string, TileData> = new Map()
  has(x: number, y: number): boolean {
    return this.data.has(TileMap.keyFromXY(x, y))
  }
  get(x: number, y: number): TileData | undefined {
    return this.data.get(TileMap.keyFromXY(x, y))
  }
  set(x: number, y: number, tile: TileData): void {
    this.data.set(TileMap.keyFromXY(x, y), tile)
  }
  addTile(tile: TileData): void {
    this.data.set(TileMap.keyFromXY(tile.x, tile.y), tile)
  }
  static keyFromXY(x: number, y: number) {
    return x + ':' + y
  }
}
