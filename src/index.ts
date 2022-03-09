import './style.css'
import { World } from './ecs'
import { addComponent, addEntity, resetWorld } from 'bitecs'
import { Sprite } from 'pixi.js'
import { initPixi, OverlaySprites, resetPixi } from './pixi'
import { DisplayObject, GridPosition, Health, setEntGrid, CanSwim, CanWalk, OnTileType, Scent } from './ecs/components'
import { getTexture, resetSprites, SpritesByEID } from './sprites'
import { createLevel, MAP_HEIGHT, MAP_WIDTH, OpenFloors } from './level'
import { drawHud, initHud, resetHud } from './hud'
import { resetFOV } from './fov'
import { initCasting, resetCasting } from './casting'
import { setPlayerState } from './ecs/input_systems'
import { RNG } from 'rot-js'

export const TILE_SIZE = 16

export let PlayerEntity: number
export let PlayerSprite: Sprite

type GameStates = 'Playing' | 'Losing' | 'Lost' | 'Won'
export let GameState: GameStates
export const setGameState = (state: GameStates) => (GameState = state)

const PLAYER_HEALTH = 10

export function startGame() {
  PlayerEntity = addEntity(World)
  PlayerSprite = new Sprite(getTexture('player'))
  SpritesByEID[PlayerEntity] = PlayerSprite
  OverlaySprites.addChild(PlayerSprite)

  createLevel()

  addComponent(World, DisplayObject, PlayerEntity)
  addComponent(World, OnTileType, PlayerEntity)
  addComponent(World, GridPosition, PlayerEntity)
  const playerStart = /*{ x: MAP_WIDTH/2, y: MAP_HEIGHT/2 }*/ RNG.getItem(OpenFloors)!
  setEntGrid(PlayerEntity, playerStart)
  addComponent(World, CanWalk, PlayerEntity)
  addComponent(World, CanSwim, PlayerEntity)
  addComponent(World, Scent, PlayerEntity)
  Scent.range[PlayerEntity] = 3
  addComponent(World, Health, PlayerEntity)
  Health.max[PlayerEntity] = PLAYER_HEALTH
  Health.current[PlayerEntity] = PLAYER_HEALTH

  initCasting()

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
