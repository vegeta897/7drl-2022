import { addComponent, System } from 'bitecs'
import { GameState, onInput, World } from './'
import { CastTargetSprite, PlayerEntity } from '../'
import { MoveAction } from './components'
import { DirectionGrids, DirectionNames } from '../vector2'
import { drawHud } from '../hud'
import { angleBait, beginCast, confirmCast, cutLine, moveCastTarget } from '../casting'

export const waitForInput = () => {
  WaitingForInput = true
  if (buttonQueued) onInput()
}
export const processInput = () => (WaitingForInput = false)
export let WaitingForInput = true

type PlayerStates = 'idle' | 'casting' | 'angling'
export let PlayerState: PlayerStates = 'idle'
export const setPlayerState = (state: PlayerStates) => (PlayerState = state)

export const inputSystem: System = (world) => {
  buttonQueued = false
  if (!button) return world
  const previousState = PlayerState
  switch (button) {
    case 'cast':
      if (previousState === 'idle') beginCast()
      if (previousState === 'casting') confirmCast()
      if (previousState === 'angling') cutLine()
      break
    case 'wait':
      WaitingForInput = false
      break
    case 'confirm':
      if (previousState === 'casting') confirmCast()
      break
    case 'exit':
      PlayerState = 'idle'
      CastTargetSprite.visible = false
      break
    default:
      const move = DirectionGrids[DirectionNames.indexOf(button)]
      if (previousState === 'casting') {
        moveCastTarget(move)
      } else if (previousState === 'angling') {
        angleBait(move)
      } else {
        const boost = Keys.has('ControlLeft') || Keys.has('ControlRight')
        const noclip = Keys.has('ShiftLeft') || Keys.has('ShiftRight')
        addComponent(World, MoveAction, PlayerEntity)
        MoveAction.x[PlayerEntity] = move.x * (boost ? 10 : 1)
        MoveAction.y[PlayerEntity] = move.y * (boost ? 10 : 1)
        MoveAction.noclip[PlayerEntity] = noclip || boost ? 1 : 0
        WaitingForInput = false
      }
  }
  drawHud()
  return world
}

const Keys: Set<GameKey> = new Set()
let button: Button
let buttonQueued = false

const isGameKey = (key: string): key is GameKey => gameKeys.includes(key as GameKey)

window.addEventListener('keydown', async (e) => {
  if (e.repeat) return
  if (!isGameKey(e.code)) return
  e.preventDefault()
  Keys.add(e.code)
  button = getButton(e.code)
  if (button) {
    if (WaitingForInput) await onInput()
    else if (GameState === 'AnimateEnemies') buttonQueued = true
  }
})
window.addEventListener('keyup', (e) => {
  if (!isGameKey(e.code)) return
  Keys.delete(e.code)
})

type Button = typeof DirectionNames[number] | 'wait' | 'cast' | 'exit' | 'confirm' | null
function getButton(keyCode: GameKey): Button {
  switch (keyCode) {
    case 'KeyW':
    case 'KeyK':
    case 'ArrowUp':
      return 'up'
    case 'KeyS':
    case 'KeyJ':
    case 'ArrowDown':
      return 'down'
    case 'KeyA':
    case 'KeyH':
    case 'ArrowLeft':
      return 'left'
    case 'KeyD':
    case 'KeyL':
    case 'ArrowRight':
      return 'right'
    case 'KeyC':
      return 'cast'
    case 'Escape':
      return 'exit'
    case 'Space':
      return 'wait'
    case 'Enter':
      return 'confirm'
  }
  return null
}

type GameKey = typeof gameKeys[number]

const gameKeys = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyK',
  'KeyJ',
  'KeyH',
  'KeyL',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyC',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'Space',
  'Enter',
  'Escape',
] as const
