import { get4Neighbors, get8Neighbors, Vector2 } from './vector2'
import { Sprite } from 'pixi.js'

export class GridMap<T> {
  data: Map<string, T> = new Map()
  get(grid: Vector2): T | undefined {
    return this.data.get(GridMap.Key(grid))
  }
  set(grid: Vector2, value: T): void {
    this.data.set(GridMap.Key(grid), value)
  }
  has(grid: Vector2): boolean {
    return this.data.has(GridMap.Key(grid))
  }
  delete(grid: Vector2): void {
    this.data.delete(GridMap.Key(grid))
  }
  static Key(grid: Vector2): string {
    return grid.x + ':' + grid.y
  }
}

export enum Tile {
  Floor,
  Wall,
  Water,
  Shallows,
}

const EmptyTile = {
  type: Tile.Floor,
  seeThrough: true,
  solid: false,
  revealed: 0,
}

export class TileMap extends GridMap<TileData> {
  get(grid: Vector2): TileData {
    return this.data.get(GridMap.Key(grid)) || { ...EmptyTile, x: grid.x, y: grid.y }
  }
  get4Neighbors(grid: Vector2): TileData[] {
    return get4Neighbors(grid).map((g) => this.get(g))
  }
  get8Neighbors(grid: Vector2): TileData[] {
    return get8Neighbors(grid).map((g) => this.get(g))
  }
  createTile(grid: Vector2, tileType: Tile): void {
    const tileData: TileData = { ...EmptyTile, ...grid, type: tileType }
    switch (tileType) {
      case Tile.Wall:
        tileData.seeThrough = false
        tileData.solid = true
        break
      case Tile.Water:
        tileData.pondIndex = -1
        break
      case Tile.Shallows:
        tileData.seeThrough = false
        break
    }
    this.set(grid, tileData)
  }
}

export type TileData = {
  sprite?: Sprite
  x: number
  y: number
  type: Tile
  seeThrough: boolean
  pondIndex?: number
  solid: boolean
  tint?: number
  ignoreFOV?: boolean
  revealed: number
}

export function isWet(tile: Tile): boolean {
  if (tile === Tile.Water) return true
  return tile === Tile.Shallows
}
