import './style.css'
import { resetNonPlayerEntities, World } from './ecs'
import { addComponent, addEntity, resetWorld } from 'bitecs'
import { Sprite } from 'pixi.js'
import { initPixi, OverlaySprites, PixiViewport, resetPixi, startPixi } from './pixi'
import {
  DisplayObject,
  GridPosition,
  Health,
  CanSwim,
  CanWalk,
  OnTileType,
  Scent,
  initEntGrid,
  CanAttack,
} from './ecs/components'
import { addSprite, getTexture, resetSprites } from './sprites'
import { createLevel } from './level'
import { drawHud, initHud, clearLog, updateHud, defaultHud, bigHud, logMessage, Colors } from './hud'
import { resetFOV, updateEntityVisibility, updateVisibility } from './fov'
import { initCasting, resetCasting } from './casting'
import { setPlayerState, waitForInput } from './ecs/input_systems'
import { clearInventory } from './inventory'

export const TILE_SIZE = 16

export let PlayerEntity: number
export let PlayerSprite: Sprite

type GameStates =
  | 'Loading'
  | 'Generating'
  | 'Playing'
  | 'EndLevel'
  | 'Losing'
  | 'Lost'
  | 'Won'
  | 'CriticalFailure'
  | 'LevelGenFailed'
export let GameState: GameStates = 'Loading'
export let CurrentLevel: number
export const LastLevel = 3
export const nextLevel = () => {
  CurrentLevel++
  resetNonPlayerEntities()
  startLevel()
}
export const setGameState = (state: GameStates) => {
  GameState = state
  updateHud()
}

const PLAYER_HEALTH = 10

async function startGame() {
  clearLog()
  CurrentLevel = 1
  clearInventory()
  PlayerEntity = addEntity(World)
  PlayerSprite = new Sprite(getTexture('player'))
  addSprite(PlayerEntity, PlayerSprite, OverlaySprites, true)
  addComponent(World, DisplayObject, PlayerEntity)
  addComponent(World, OnTileType, PlayerEntity)
  addComponent(World, GridPosition, PlayerEntity)
  addComponent(World, CanWalk, PlayerEntity)
  addComponent(World, CanSwim, PlayerEntity)
  addComponent(World, CanAttack, PlayerEntity)
  CanAttack.damage[PlayerEntity] = 1
  CanAttack.maxAdditional[PlayerEntity] = 1
  addComponent(World, Scent, PlayerEntity)
  Scent.range[PlayerEntity] = 3
  addComponent(World, Health, PlayerEntity)
  Health.max[PlayerEntity] = PLAYER_HEALTH
  Health.current[PlayerEntity] = PLAYER_HEALTH

  initCasting()

  await startLevel()
}

async function startLevel() {
  GameState = 'Generating'
  bigHud()
  let playerStart
  try {
    playerStart = await createLevel(CurrentLevel)
  } catch (e) {
    console.error(e)
    // @ts-ignore
    if (GameState !== 'LevelGenFailed') GameState = 'CriticalFailure'
    drawHud()
    return
  }
  initEntGrid(PlayerEntity, playerStart)
  PixiViewport.moveCenter({
    x: PlayerSprite.x + TILE_SIZE / 2,
    y: PlayerSprite.y + TILE_SIZE / 2,
  })

  resetFOV()
  updateVisibility()
  updateEntityVisibility()

  GameState = 'Playing'
  waitForInput()
  defaultHud()
  if (CurrentLevel === LastLevel) {
    logMessage('You ascend the ladder, and sense that you are near the surface now...', Colors.TheLight)
  } else if (CurrentLevel > 1) {
    logMessage('You ascend the ladder...', Colors.TheLight)
  }
  drawHud()
}

export function resetGame() {
  resetPixi()
  resetSprites()
  resetWorld(World)
  resetCasting()
  setPlayerState('Idle')
  startGame()
}

window.onload = async (): Promise<void> => {
  initHud()
  await initPixi()
  await startGame()
  startPixi()
}
