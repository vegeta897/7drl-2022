export type Vector2 = {
  x: number
  y: number
}

export enum Direction {
  Up,
  Down,
  Left,
  Right,
}

export const GridZero = { x: 0, y: 0 }

export const Up = { x: 0, y: -1 }
export const Down = { x: 0, y: 1 }
export const Left = { x: -1, y: 0 }
export const Right = { x: 1, y: 0 }

export const UpLeft = { x: -1, y: -1 }
export const UpRight = { x: 1, y: -1 }
export const DownLeft = { x: -1, y: 1 }
export const DownRight = { x: 1, y: 1 }

export const DirectionGrids = [Up, Down, Left, Right] as const
export const DirectionNames = ['up', 'down', 'left', 'right'] as const

export const getCardinalDirection = (from: Vector2, to: Vector2): Direction => {
  const { x: xDiff, y: yDiff } = diffVector2(from, to)
  if (xDiff > 0 && Math.abs(xDiff) >= Math.abs(yDiff)) return Direction.Right
  if (xDiff < 0 && Math.abs(xDiff) >= Math.abs(yDiff)) return Direction.Left
  if (yDiff < 0 && Math.abs(yDiff) > Math.abs(xDiff)) return Direction.Up
  return Direction.Down
}

export const vectorsAreInline = (a: Vector2, b: Vector2): boolean => a.x === b.x || a.y === b.y
export const vectorsAreParallel = (a: Vector2, b: Vector2): boolean => {
  if ((a.x === 0 && a.y === 0) || (b.x === 0 && b.y === 0)) return false
  if ((a.x !== 0 && a.y !== 0) || (b.x !== 0 && b.y !== 0)) return false
  return (a.x === 0) === (b.x === 0)
}
export const vectorsAreEqual = (a: Vector2, b: Vector2): boolean => a.x === b.x && a.y === b.y

export const addVector2 = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y })
export const diffVector2 = (a: Vector2, b: Vector2): Vector2 => ({ x: b.x - a.x, y: b.y - a.y })
export const multiplyVector2 = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x * b.x, y: a.y * b.y })
export const scaleVector2 = (v: Vector2, scalar: number): Vector2 => ({ x: v.x * scalar, y: v.y * scalar })
export const invertVector2 = (v: Vector2): Vector2 => ({ x: -v.x, y: -v.y })
export const getUnitVector2 = (v: Vector2): Vector2 => DirectionGrids[getCardinalDirection(GridZero, v)]

export const get4Neighbors = (grid: Vector2): Vector2[] => {
  return [Up, Down, Left, Right].map((d) => addVector2(grid, d))
}
export const get8Neighbors = (grid: Vector2): Vector2[] => {
  return [Up, Down, Left, Right, UpLeft, UpRight, DownLeft, DownRight].map((d) => addVector2(grid, d))
}
export const getSquareAround = (grid: Vector2, radius: number): Vector2[] => {
  const inSquare = []
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      inSquare.push(addVector2(grid, { x: dx, y: dy }))
    }
  }
  return inSquare
}
export const getDiamondAround = (grid: Vector2, radius: number): Vector2[] => {
  return getSquareAround(grid, radius).filter((g) => getDistance(grid, g) <= radius)
}
export const getCross = (grid: Vector2, radius: number): Vector2[] => {
  return getSquareAround(grid, radius).filter((g) => g.x === grid.x || g.y === grid.y)
}
export const getStraightLine = (from: Vector2, to: Vector2, includeEndpoints = true): Vector2[] => {
  if (!vectorsAreInline(from, to)) throw `Can't get straight line between ${from.x}:${from.y} and ${to.x}:${to.y}`
  const line = []
  if (includeEndpoints) line.push(from)
  const distance = getDistance(from, to)
  const direction = DirectionGrids[getCardinalDirection(from, to)]
  let currentNode = from
  for (let i = 1; i < distance; i++) {
    currentNode = addVector2(currentNode, direction)
    line.push(currentNode)
  }
  if (includeEndpoints) line.push(to)
  return line
}

export const getDistance = (a: Vector2, b: Vector2 = GridZero): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export const sortByDistance = (origin: Vector2, grids: Vector2[], nearestFirst = true) =>
  [...grids].sort((a, b) => getDistance(origin, nearestFirst ? a : b) - getDistance(origin, nearestFirst ? b : a))
