import { Sprite, Texture } from 'pixi.js'
import spriteData from '../assets/sprites.json'

export const SpritesByEID: Sprite[] = []

const textures: Record<string, Texture> = {}

export function initSprites() {
  for (const [key] of Object.entries(spriteData.frames)) {
    textures[key] = Texture.from(key)
  }
}

export function getTexture(name: string): Texture {
  return textures[name]
}

export function resetSprites() {
  SpritesByEID.length = 0
}
