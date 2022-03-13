import { get4Neighbors, get8Neighbors, getDiamondAround, getDistance, getSquareAround, Vector2 } from './vector2'
import { Sprite } from 'pixi.js'
import { Level } from './level'
import { createTileSprite, getTexture, getTileTexture } from './sprites'
import { RNG } from 'rot-js'

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
  Empty,
  Floor,
  Wall,
  Water,
  Shallows,
  Path,
  Stalagmite,
  Rubble,
}

const EmptyTile = {
  type: Tile.Empty,
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
  getSquareAround(grid: Vector2, radius: number): TileData[] {
    return getSquareAround(grid, radius)
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
      case Tile.Stalagmite:
        tileData.solid = true
        break
    }
    this.set({ x, y }, tileData)
  }
  isOutOfBounds({ x, y }: Vector2) {
    return x < 0 || y < 0 || x >= this.width || y >= this.height
  }
  loadRotJSMap(map: (0 | 1 | 2)[][]) {
    // rot.js uses x-first 2D arrays!
    for (let x = -1; x < this.width + 1; x++) {
      for (let y = -1; y < this.height + 1; y++) {
        let tileType
        if (this.isOutOfBounds({ x, y }) || map[x][y] === 0) tileType = Tile.Wall
        else tileType = map[x][y] === 1 ? Tile.Floor : Tile.Path
        Level.createTile({ x, y }, tileType)
      }
    }
  }
  getContiguousAreas(tileCheck: (tile: TileData) => boolean, maxSize = 0): TileData[][] {
    const areas: TileData[][] = []
    const crawled = new Set()
    this.data.forEach((tile) => {
      if (!tileCheck(tile)) return
      if (crawled.has(tile)) return
      const uncheckedNeighbors = new Set([tile])
      const area: TileData[] = []
      let currentTile: TileData
      do {
        currentTile = [...uncheckedNeighbors.values()][0]
        uncheckedNeighbors.delete(currentTile)
        area.push(currentTile)
        if (maxSize && area.length > maxSize) return
        crawled.add(currentTile)
        this.get4Neighbors(currentTile).forEach((t) => {
          if (!crawled.has(t) && tileCheck(t)) uncheckedNeighbors.add(t)
        })
      } while (uncheckedNeighbors.size > 0)
      if (!maxSize || area.length <= maxSize) areas.push(area)
    })
    return areas
  }
  removeRedundantWalls() {
    const toRemove: Vector2[] = []
    this.data.forEach((tile) => {
      if (this.get8Neighbors(tile).every((t) => !t.seeThrough && t.solid)) toRemove.push(tile)
    })
    for (const tile of toRemove) {
      this.delete(tile)
    }
  }
  mineTile(grid: Vector2) {
    const tile = this.get(grid)
    tile.type = Tile.Floor
    tile.sprite!.texture = getTexture(getTileTexture({ ...tile, type: Tile.Rubble }))
    tile.solid = false
    tile.seeThrough = true
    for (const neighbor of get8Neighbors(grid)) {
      if (!this.has(neighbor)) {
        this.createTile(neighbor, Tile.Wall)
        createTileSprite(this.get(neighbor))
      } else if (getDistance(tile, neighbor) === 1) {
        const neighborTile = this.get(neighbor)
        if (neighborTile.type === Tile.Wall) neighborTile.sprite!.texture = getTexture(getTileTexture(neighborTile))
      }
    }
  }
  dryTile(grid: Vector2) {
    const tile = this.get(grid)
    tile.type = Tile.Floor
    tile.sprite!.texture = getTexture(getTileTexture(tile))
    for (const neighbor of get4Neighbors(grid)) {
      const neighborTile = this.get(neighbor)
      if (neighborTile.type === Tile.Shallows || neighborTile.type === Tile.Water)
        neighborTile.sprite!.texture = getTexture(getTileTexture({ ...neighborTile, type: Tile.Water }))
    }
  }
  floodTile(grid: Vector2, volume: number) {
    // This is one of the coolest things I've put in a game
    const checkedTiles: Set<TileData> = new Set()
    const floodedTiles: Set<TileData> = new Set()
    const unfloodedTiles: TileData[] = [this.get(grid)]
    do {
      if (checkedTiles.size > 80) break // Let's not get crazy
      const toFlood = unfloodedTiles.shift()!
      checkedTiles.add(toFlood)
      if (toFlood.type !== Tile.Water && toFlood.type !== Tile.Shallows) {
        toFlood.type = Tile.Water
        floodedTiles.add(toFlood)
        volume--
        if (volume === 0) break
      }
      RNG.shuffle(this.get4Neighbors(toFlood)).forEach((neighbor) => {
        if (
          !checkedTiles.has(neighbor) &&
          !floodedTiles.has(neighbor) &&
          (neighbor.type === Tile.Water ||
            neighbor.type === Tile.Shallows ||
            neighbor.type === Tile.Floor ||
            neighbor.type === Tile.Path ||
            neighbor.type === Tile.Rubble)
        )
          unfloodedTiles.push(neighbor)
      })
    } while (unfloodedTiles.length > 0)
    for (const flooded of floodedTiles) {
      const distance = getDistance(flooded, grid)
      setTimeout(() => {
        flooded.sprite!.texture = getTexture(getTileTexture(flooded))
        for (const neighbor of get4Neighbors(flooded)) {
          const neighborTile = this.get(neighbor)
          if (floodedTiles.has(neighborTile)) continue
          if (neighborTile.type === Tile.Shallows || neighborTile.type === Tile.Water) {
            neighborTile.sprite!.texture = getTexture(getTileTexture({ ...neighborTile, type: Tile.Water }))
          }
        }
      }, 150 * (distance + 1)) // So hacky!
    }
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
  if (tile === Tile.Rubble) return true
  return tile === Tile.Shallows
}
