import { Sprite, Texture } from 'pixi.js'
import spriteData from '../assets/sprites.json'
import { EntitySprites, WorldSprites } from './pixi'
import { Tile } from './map'
import { RNG } from 'rot-js'
import { TILE_SIZE } from './index'
import { ALL_VISIBLE, Level } from './level'

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

export function createMapSprites(rng: typeof RNG) {
  const getTileTexture = (tile: Tile): string => {
    switch (tile) {
      case Tile.Floor:
        return rng.getItem(['floor1', 'floor2', 'floor3', 'floor4'])!
      case Tile.Wall:
        return 'wall'
      case Tile.Water:
        return 'water'
      case Tile.Shallows:
        return 'waterReeds'
      case Tile.Path:
        return 'floorBricks'
      case Tile.Stalagmite:
        return 'stalagmites1'
    }
    throw `No texture found for tile type ${tile}`
  }
  while (WorldSprites.children[0]) {
    WorldSprites.children[0].destroy({ children: true })
  }
  Level.data.forEach((tile) => {
    tile.sprite = new Sprite(getTexture(getTileTexture(tile.type)))
    tile.sprite.x = tile.x * TILE_SIZE
    tile.sprite.y = tile.y * TILE_SIZE
    if (!ALL_VISIBLE) tile.sprite.alpha = 0
    WorldSprites.addChild(tile.sprite)
  })
}

export function resetSprites() {
  SpritesByEID.length = 0
}
