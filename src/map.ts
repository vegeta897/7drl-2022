import { Vector2 } from './vector2'

export class GridMap<T, D = undefined> {
  data: Map<string, T> = new Map()
  defaultValue: D
  constructor(defaultValue?: D) {
    this.defaultValue = <D>defaultValue
  }
  get(grid: Vector2): T | D {
    return this.data.get(GridMap.Key(grid)) ?? this.defaultValue
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
