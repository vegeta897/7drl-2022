import './style.css'
import { World } from './ecs'
import { addComponent, addEntity } from 'bitecs'
import { Sprite, Texture } from 'pixi.js'
import { initPixi, OverlaySprites, PixiViewport, WorldSprites } from './pixi'
import {
  DisplayObject,
  Fish,
  GridPosition,
  Health,
  Predator,
  setEntGrid,
  Swimmer,
  Walker,
  Wander,
} from './ecs/components'
import { SpritesByEID } from './sprites'
import { createLevel, OpenFloors, OpenWaters } from './level'
import { RNG } from 'rot-js'
import { drawHud, initHud } from './hud'
import { Vector2 } from './vector2'

export const TILE_SIZE = 16

export const PlayerEntity = addEntity(World)
export let PlayerSprite: Sprite
export let CastTargetSprite: Sprite

window.onload = async (): Promise<void> => {
  initHud()
  await initPixi()

  createLevel()

  PlayerSprite = new Sprite(Texture.from('player'))
  SpritesByEID[PlayerEntity] = PlayerSprite
  OverlaySprites.addChild(PlayerSprite)
  addComponent(World, DisplayObject, PlayerEntity)
  addComponent(World, GridPosition, PlayerEntity)
  setEntGrid(PlayerEntity, RNG.getItem(OpenFloors)!)
  addComponent(World, Walker, PlayerEntity)
  addComponent(World, Health, PlayerEntity)
  Health.max[PlayerEntity] = 10
  Health.current[PlayerEntity] = 10

  PixiViewport.moveCenter(PlayerSprite)

  for (let i = 0; i < OpenWaters.length / 4; i++) {
    const fishStart = RNG.getItem(OpenWaters)!
    addFish(fishStart)
  }

  CastTargetSprite = new Sprite(Texture.from('target'))
  PlayerSprite.addChild(CastTargetSprite)
  CastTargetSprite.visible = false

  drawHud()
}

function addFish(grid: Vector2) {
  const fish = addEntity(World)
  const fishSprite = new Sprite(Texture.from('fish'))
  SpritesByEID[fish] = fishSprite
  WorldSprites.addChild(fishSprite)
  addComponent(World, DisplayObject, fish)
  addComponent(World, GridPosition, fish)
  setEntGrid(fish, grid)
  addComponent(World, Wander, fish)
  Wander.maxChance[fish] = 10
  Wander.chance[fish] = RNG.getUniformInt(0, 10)
  addComponent(World, Swimmer, fish)
  addComponent(World, Predator, fish)
  Predator.range[fish] = 4
  addComponent(World, Health, fish)
  Health.max[fish] = 4
  Health.current[fish] = 4
  addComponent(World, Fish, fish)
}
