import './style.css'
import { World } from './ecs'
import { addComponent, addEntity } from 'bitecs'
import { Sprite, Texture } from 'pixi.js'
import { initPixi, OverlaySprites, PixiViewport, WorldSprites } from './pixi'
import {
  ActionTimer,
  DisplayObject,
  GridPosition,
  Health,
  Player,
  SensePlayer,
  Swimmer,
  Walker,
  Wander,
} from './ecs/components'
import { SpritesByEID } from './sprites'
import { createLevel, EntityMap, OpenFloors, OpenWaters, TileMap } from './level'
import { RNG } from 'rot-js'
import { drawHud, initHud } from './hud'

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
  addComponent(World, Player, PlayerEntity)
  addComponent(World, DisplayObject, PlayerEntity)
  addComponent(World, GridPosition, PlayerEntity)
  const playerStart = RNG.getItem(OpenFloors)!
  GridPosition.x[PlayerEntity] = playerStart.x
  GridPosition.y[PlayerEntity] = playerStart.y
  EntityMap.set(TileMap.keyFromXY(playerStart.x, playerStart.y), PlayerEntity)
  addComponent(World, Walker, PlayerEntity)
  addComponent(World, Health, PlayerEntity)
  Health.max[PlayerEntity] = 10
  Health.current[PlayerEntity] = 10

  PixiViewport.moveCenter(PlayerSprite)

  for (let i = 0; i < OpenWaters.length / 4; i++) {
    const fishStart = RNG.getItem(OpenWaters)!
    addFish(fishStart.x, fishStart.y)
  }

  CastTargetSprite = new Sprite(Texture.from('target'))
  PlayerSprite.addChild(CastTargetSprite)
  CastTargetSprite.visible = false

  drawHud()
}

function addFish(x: number, y: number) {
  const fish = addEntity(World)
  const fishSprite = new Sprite(Texture.from('fish'))
  SpritesByEID[fish] = fishSprite
  WorldSprites.addChild(fishSprite)
  addComponent(World, DisplayObject, fish)
  addComponent(World, GridPosition, fish)
  GridPosition.x[fish] = x
  GridPosition.y[fish] = y
  EntityMap.set(TileMap.keyFromXY(x, y), fish)
  addComponent(World, Wander, fish)
  Wander.maxChance[fish] = 10
  Wander.chance[fish] = RNG.getUniformInt(0, 10)
  addComponent(World, ActionTimer, fish)
  ActionTimer.timeLeft[fish] = 0
  addComponent(World, Swimmer, fish)
  addComponent(World, SensePlayer, fish)
  SensePlayer.range[fish] = 3
  addComponent(World, Health, fish)
  Health.max[fish] = 4
  Health.current[fish] = 4
}
