import { Sprite } from 'pixi.js'

export const SpritesByEID: Sprite[] = []

export function resetSprites() {
  SpritesByEID.length = 0
}
