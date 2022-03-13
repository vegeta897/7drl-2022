import { Sprite, Texture } from 'pixi.js'
import spriteData from '../assets/sprites.json'
import { EntitySprites, WorldSprites } from './pixi'
import { Tile, TileData } from './map'
import { RNG } from 'rot-js'
import { TILE_SIZE } from './index'
import { ALL_VISIBLE, Level } from './level'
import { get4Neighbors } from './vector2'

export const SpritesByEID: Sprite[] = []

const textures: Record<string, Texture> = {}

export function initTextures() {
  for (const [key] of Object.entries(spriteData.frames)) {
    textures[key] = Texture.from(key)
  }
}

export function getTexture(name: string): Texture {
  return textures[name]
}

export function addSprite(eid: number, sprite: Sprite, container = EntitySprites, insertFirst = false) {
  SpritesByEID[eid] = sprite
  if (insertFirst) container.addChildAt(sprite, 0)
  else container.addChild(sprite)
}

const getNeighborString = (tile: TileData, neighborTypes: Tile[]): string => {
  return get4Neighbors(tile)
    .filter((g) => neighborTypes.includes(Level.get(g).type))
    .map((g) => g.d)
    .sort((a, b) => 'NESW'.indexOf(a) - 'NESW'.indexOf(b))
    .join('')
}

const floors = ['floor1', 'floor1', 'floor1', 'floor2', 'floor3', 'floor4', 'floor5', 'floor6']
export const getTileTexture = (tile: TileData): string => {
  switch (tile.type) {
    case Tile.Floor:
      return RNG.getItem(floors)!
    case Tile.Wall:
      return 'caveWall' + getNeighborString(tile, [Tile.Wall, Tile.Empty])
    case Tile.Water:
      return 'water' + getNeighborString(tile, [Tile.Water, Tile.Shallows])
    case Tile.Shallows:
      return 'waterReeds'
    case Tile.Path:
      return 'floorBricks'
    case Tile.Stalagmite:
      return 'stalagmites1'
  }
  throw `No texture found for tile type ${tile}`
}

export const getTileSprite = (tile: TileData): Sprite => {
  let baseTile = tile
  if (tile.type === Tile.Shallows) baseTile = { ...tile, type: Tile.Water }
  const sprite = new Sprite(getTexture(getTileTexture(baseTile)))
  if (tile.type === Tile.Shallows) {
    const reeds = new Sprite(getTexture(getTileTexture(tile)))
    sprite.addChild(reeds)
  }
  return sprite
}

export function createMapSprites() {
  while (WorldSprites.children[0]) {
    WorldSprites.children[0].destroy({ children: true })
  }
  Level.data.forEach((tile) => createTileSprite(tile))
}

export function createTileSprite(tile: TileData) {
  tile.sprite = getTileSprite(tile)
  tile.sprite.x = tile.x * TILE_SIZE
  tile.sprite.y = tile.y * TILE_SIZE
  if (!ALL_VISIBLE) tile.sprite.alpha = 0
  WorldSprites.addChild(tile.sprite)
}

export function resetSprites() {
  SpritesByEID.length = 0
}
