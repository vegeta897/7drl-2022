import './style.css'
import { World } from './ecs'
import { addComponent, addEntity, resetWorld } from 'bitecs'
import { Sprite } from 'pixi.js'
import { initPixi, OverlaySprites, resetPixi, startPixi } from './pixi'
import { DisplayObject, GridPosition, Health, setEntGrid, CanSwim, CanWalk, OnTileType, Scent } from './ecs/components'
import { addSprite, getTexture, resetSprites } from './sprites'
import { createLevel } from './level'
import { drawHud, initHud, resetHud, updateHud } from './hud'
import { resetFOV, updateEntityVisibility, updateVisibility } from './fov'
import { initCasting, resetCasting } from './casting'
import { setPlayerState } from './ecs/input_systems'

export const TILE_SIZE = 16

export let PlayerEntity: number
export let PlayerSprite: Sprite

type GameStates = 'Loading' | 'Playing' | 'ChangeLevel' | 'Losing' | 'Lost' | 'Won' | 'CriticalFailure'
export let GameState: GameStates = 'Loading'
export let CurrentLevel: number
export const LastLevel = 3
export const setGameState = (state: GameStates) => {
  GameState = state
  updateHud()
}

const PLAYER_HEALTH = 10

// TODO: Create startLevel()
// Avoid re-initializing as much as possible

async function startGame() {
  CurrentLevel = 1
  PlayerEntity = addEntity(World)

  let playerStart
  try {
    playerStart = await createLevel(CurrentLevel)
  } catch (e) {
    GameState = 'CriticalFailure'
    resetHud()
    drawHud()
    return
  }

  PlayerSprite = new Sprite(getTexture('player'))
  addSprite(PlayerEntity, PlayerSprite, OverlaySprites, true)
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

async function startLevel() {}

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
