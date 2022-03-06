import './style.css'
import { World } from './ecs'
import { addComponent, addEntity } from 'bitecs'
import { Sprite, Texture } from 'pixi.js'
import { initPixi, PixiViewport } from './pixi'
import { ActionTimer, DisplayObject, GridPosition, RandomWalk, Swimmer } from './ecs/components'
import { SpritesByEID } from './sprites'
import { createLevel, OpenFloors, OpenWaters } from './level'
import { Display, RNG } from 'rot-js'

export const TILE_SIZE = 16

export const PlayerEntity = addEntity(World)
export let PlayerSprite: Sprite

window.onload = async (): Promise<void> => {
  const display = new Display({ width: 20, height: 30, fontSize: 20, fontStyle: 'bold' })
  document.body.appendChild(display.getContainer()!)
  display.drawText(0, 0, 'hello')

  await initPixi()

  createLevel()

  PlayerSprite = new Sprite(Texture.from('player'))
  SpritesByEID[PlayerEntity] = PlayerSprite
  PixiViewport.addChild(PlayerSprite)
  addComponent(World, DisplayObject, PlayerEntity)
  addComponent(World, GridPosition, PlayerEntity)
  const playerStart = RNG.getItem(OpenFloors)!
  GridPosition.x[PlayerEntity] = playerStart.x
  GridPosition.y[PlayerEntity] = playerStart.y

  PixiViewport.moveCenter(PlayerSprite)

  for (let i = 0; i < 20; i++) {
    const fishStart = RNG.getItem(OpenWaters)!
    addFish(fishStart.x, fishStart.y)
  }
}

function addFish(x: number, y: number) {
  const fish = addEntity(World)
  const fishSprite = new Sprite(Texture.from('fish'))
  SpritesByEID[fish] = fishSprite
  PixiViewport.addChild(fishSprite)
  addComponent(World, DisplayObject, fish)
  addComponent(World, GridPosition, fish)
  addComponent(World, RandomWalk, fish)
  addComponent(World, ActionTimer, fish)
  addComponent(World, Swimmer, fish)
  ActionTimer.timeLeft[fish] = 0
  GridPosition.x[fish] = x
  GridPosition.y[fish] = y
}
