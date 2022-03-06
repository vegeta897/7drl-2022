import './style.css'
import { World } from './ecs'
import { addComponent, addEntity } from 'bitecs'
import { Sprite, Texture } from 'pixi.js'
import { initPixi, PixiViewport } from './pixi'
import { ActionTimer, DisplayObject, GridPosition, RandomWalk } from './ecs/components'
import { SpritesByEID } from './sprites'
import { createLevel, OpenAreas } from './level'
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
  const playerStart = RNG.getItem(OpenAreas)!
  GridPosition.x[PlayerEntity] = playerStart.x
  GridPosition.y[PlayerEntity] = playerStart.y

  PixiViewport.moveCenter(PlayerSprite)

  for (let i = 0; i < 20; i++) {
    const batStart = RNG.getItem(OpenAreas)!
    addBat(batStart.x, batStart.y)
  }
}

function addBat(x: number, y: number) {
  const bat = addEntity(World)
  const batSprite = new Sprite(Texture.from('bat'))
  SpritesByEID[bat] = batSprite
  PixiViewport.addChild(batSprite)
  addComponent(World, DisplayObject, bat)
  addComponent(World, GridPosition, bat)
  addComponent(World, RandomWalk, bat)
  addComponent(World, ActionTimer, bat)
  ActionTimer.timeLeft[bat] = 0
  GridPosition.x[bat] = x
  GridPosition.y[bat] = y
}
