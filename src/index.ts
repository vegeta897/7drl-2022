import './style.css'
import { World } from './ecs'
import { addComponent, addEntity, resetWorld } from 'bitecs'
import { Sprite } from 'pixi.js'
import { initPixi, OverlaySprites, PixiViewport, resetPixi, WorldSprites } from './pixi'
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
import { getTexture, resetSprites, SpritesByEID } from './sprites'
import { createLevel, DEBUG_VISIBILITY, OpenFloors, OpenWaters } from './level'
import { RNG } from 'rot-js'
import { drawHud, initHud, resetHud } from './hud'
import { Vector2 } from './vector2'
import { resetFOV } from './fov'
import { initCasting, resetCasting } from './casting'
import { setPlayerState } from './ecs/input_systems'

export const TILE_SIZE = 16

export let PlayerEntity: number
export let PlayerSprite: Sprite

type GameStates = 'Playing' | 'Losing' | 'Lost' | 'Won'
export let GameState: GameStates
export const setGameState = (state: GameStates) => (GameState = state)

const PLAYER_HEALTH = 10

export function startGame() {
  createLevel()

  PlayerEntity = addEntity(World)
  PlayerSprite = new Sprite(getTexture('player'))
  SpritesByEID[PlayerEntity] = PlayerSprite
  OverlaySprites.addChild(PlayerSprite)
  addComponent(World, DisplayObject, PlayerEntity)
  addComponent(World, GridPosition, PlayerEntity)
  setEntGrid(PlayerEntity, RNG.getItem(OpenFloors)!)
  addComponent(World, Walker, PlayerEntity)
  addComponent(World, Swimmer, PlayerEntity)
  addComponent(World, Health, PlayerEntity)
  Health.max[PlayerEntity] = PLAYER_HEALTH
  Health.current[PlayerEntity] = PLAYER_HEALTH

  PixiViewport.moveCenter(PlayerSprite)
  initCasting()

  for (let i = 0; i < OpenWaters.length / 4; i++) {
    const fishStart = RNG.getItem(OpenWaters)!
    addFish(fishStart)
  }

  GameState = 'Playing'
  drawHud()
}

export function resetGame() {
  resetHud()
  resetPixi()
  resetSprites()
  resetWorld(World)
  resetFOV()
  resetCasting()
  setPlayerState('Idle')
  startGame()
}

window.onload = async (): Promise<void> => {
  initHud()
  await initPixi()
  startGame()
}

function addFish(grid: Vector2) {
  const fish = addEntity(World)
  const fishSprite = new Sprite(getTexture('fish'))
  if (!DEBUG_VISIBILITY) fishSprite.alpha = 0
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
