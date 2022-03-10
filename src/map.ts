import { get4Neighbors, get8Neighbors, getDiamondAround, Vector2 } from './vector2'
import { Sprite } from 'pixi.js'
import { Level } from './level'

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
  Path,
}

const EmptyTile = {
  type: Tile.Floor,
  seeThrough: true,
  solid: false,
  revealed: 0,
}

export class TileMap extends GridMap<TileData> {
  constructor(public width: number, public height: number) {
    super()
  }
  get(grid: Vector2): TileData {
    return this.data.get(GridMap.Key(grid)) || { ...EmptyTile, x: grid.x, y: grid.y }
  }
  get4Neighbors(grid: Vector2): TileData[] {
    return get4Neighbors(grid)
      .filter((g) => this.has(g))
      .map((g) => this.get(g))
  }
  get8Neighbors(grid: Vector2): TileData[] {
    return get8Neighbors(grid)
      .filter((g) => this.has(g))
      .map((g) => this.get(g))
  }
  getDiamondAround(grid: Vector2, radius: number): TileData[] {
    return getDiamondAround(grid, radius)
      .filter((g) => this.has(g))
      .map((g) => this.get(g))
  }
  createTile({ x, y }: Vector2, tileType: Tile): void {
    const tileData: TileData = { ...EmptyTile, x, y, type: tileType }
    switch (tileType) {
      case Tile.Wall:
        tileData.seeThrough = false
        tileData.solid = true
        break
      case Tile.Shallows:
        tileData.seeThrough = false
        break
    }
    this.set({ x, y }, tileData)
  }
  loadRotJSMap(map: (0 | 1 | 2)[][]) {
    for (let y = 0; y < map.length; y++) {
      const row = map[y]
      for (let x = 0; x < row.length; x++) {
        const onBorder = x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1
        let tileType = row[x] === 1 ? Tile.Floor : Tile.Path
        if (onBorder || row[x] === 0) tileType = Tile.Wall
        Level.createTile({ x, y }, tileType)
      }
    }
  }
  getContiguousAreas(tileCheck: (tile: TileData) => boolean, maxSize = 0): TileData[][] {
    const areas: TileData[][] = []
    let allCrawled = new Set()
    this.data.forEach((tile) => {
      if (!tileCheck(tile)) return
      if (allCrawled.has(tile)) return
      const uncheckedNeighbors = new Set([tile])
      const area: TileData[] = []
      let currentTile: TileData
      const localCrawled = new Set()
      do {
        currentTile = [...uncheckedNeighbors.values()][0]
        uncheckedNeighbors.delete(currentTile)
        area.push(currentTile)
        if (maxSize && area.length > maxSize) return
        localCrawled.add(currentTile)
        this.get4Neighbors(currentTile).forEach((t) => {
          if (!localCrawled.has(t) && tileCheck(t)) {
            uncheckedNeighbors.add(t)
          }
        })
      } while (uncheckedNeighbors.size > 0)
      allCrawled = new Set([...allCrawled, ...localCrawled])
      areas.push(area)
    })
    return areas
  }
}

export type TileData = {
  sprite?: Sprite
  x: number
  y: number
  type: Tile
  seeThrough: boolean
  solid: boolean
  ignoreFOV?: boolean
  revealed: number
}

export function isWet(tile: Tile): boolean {
  if (tile === Tile.Water) return true
  return tile === Tile.Shallows
}

export function isWalkable(tile: Tile): boolean {
  if (tile === Tile.Floor) return true
  if (tile === Tile.Path) return true
  return tile === Tile.Shallows
}
