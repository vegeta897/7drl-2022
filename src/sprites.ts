import { Sprite, Texture } from 'pixi.js'
import spriteData from '../assets/sprites.json'
import { EntitySprites, WorldSprites } from './pixi'
import { Tile } from './map'
import { RNG } from 'rot-js'
import { TILE_SIZE } from './index'
import { DEBUG_VISIBILITY, Level } from './level'

export const SpritesByEID: Sprite[] = []

const textures: Record<string, Texture> = {}

export function initTextures() {
  for (const [key] of Object.entries(spriteData.frames)) {
    textures[key] = Texture.from(key)
  }
  wallTexture = getTexture('wall')
  floorTextures = ['floor1', 'floor2', 'floor3', 'floor4'].map((t) => getTexture(t))
  waterTexture = getTexture('water')
  shallowTexture = getTexture('waterReeds')
  floorBricksTexture = getTexture('floorBricks')
}

export function getTexture(name: string): Texture {
  return textures[name]
}

export function addSprite(eid: number, sprite: Sprite, container = EntitySprites) {
  SpritesByEID[eid] = sprite
  container.addChild(sprite)
}

let wallTexture: Texture
let floorTextures: Texture[]
let waterTexture: Texture
let shallowTexture: Texture
let floorBricksTexture: Texture

export function createMapSprites() {
  const getTileTexture = (tile: Tile) => {
    switch (tile) {
      case Tile.Floor:
        return RNG.getItem(floorTextures)!
      case Tile.Wall:
        return wallTexture
      case Tile.Water:
        return waterTexture
      case Tile.Shallows:
        return shallowTexture
      case Tile.Path:
        return floorBricksTexture
    }
  }
  Level.data.forEach((tile) => {
    tile.sprite = new Sprite(getTileTexture(tile.type))
    tile.sprite.x = tile.x * TILE_SIZE
    tile.sprite.y = tile.y * TILE_SIZE
    if (!DEBUG_VISIBILITY) tile.sprite.alpha = 0
    WorldSprites.addChild(tile.sprite)
  })
}

export function resetSprites() {
  SpritesByEID.length = 0
}
