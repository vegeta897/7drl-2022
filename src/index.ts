import './style.css'
import { World } from './ecs'
import { addComponent, addEntity, resetWorld } from 'bitecs'
import { Sprite } from 'pixi.js'
import { initPixi, OverlaySprites, resetPixi, startPixi } from './pixi'
import { DisplayObject, GridPosition, Health, setEntGrid, CanSwim, CanWalk, OnTileType, Scent } from './ecs/components'
import { addSprite, getTexture, resetSprites, SpritesByEID } from './sprites'
import { createLevel, MAP_HEIGHT, MAP_WIDTH } from './level'
import { drawHud, initHud, resetHud } from './hud'
import { resetFOV, updateEntityVisibility, updateVisibility } from './fov'
import { initCasting, resetCasting } from './casting'
import { setPlayerState } from './ecs/input_systems'

export const TILE_SIZE = 16

export let PlayerEntity: number
export let PlayerSprite: Sprite

type GameStates = 'Loading' | 'Playing' | 'Losing' | 'Lost' | 'Won'
export let GameState: GameStates = 'Loading'
export const setGameState = (state: GameStates) => (GameState = state)

const PLAYER_HEALTH = 10

async function startGame() {
  PlayerEntity = addEntity(World)

  const playerStart = createLevel()

  PlayerSprite = new Sprite(getTexture('player'))
  addSprite(PlayerEntity, PlayerSprite, OverlaySprites)
  addComponent(World, DisplayObject, PlayerEntity)
  addComponent(World, OnTileType, PlayerEntity)
  addComponent(World, GridPosition, PlayerEntity)
  setEntGrid(PlayerEntity, playerStart)
  addComponent(World, CanWalk, PlayerEntity)
  addComponent(World, CanSwim, PlayerEntity)
  addComponent(World, Scent, PlayerEntity)
  Scent.range[PlayerEntity] = 3
  addComponent(World, Health, PlayerEntity)
  Health.max[PlayerEntity] = PLAYER_HEALTH
  Health.current[PlayerEntity] = PLAYER_HEALTH

  initCasting()

  updateVisibility()
  updateEntityVisibility()

  GameState = 'Playing'
  resetHud()
  drawHud()
  startPixi()
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
