import { addComponent, System } from 'bitecs'
import { LoopState, onInput, World } from './'
import { GameState, PlayerEntity, resetGame } from '../'
import { MoveAction } from './components'
import { DirectionGrids, DirectionNames } from '../vector2'
import { drawHud, updateHud } from '../hud'
import { angleBait, beginCast, cancelCast, confirmCast, cutLine, moveCastTarget } from '../casting'
import { eatBait, toggleLure } from '../inventory'

export const waitForInput = () => {
  WaitingForInput = true
  if (buttonQueued) onInput()
}
export const processInput = () => (WaitingForInput = false)
export let WaitingForInput = false

type PlayerStates = 'Idle' | 'Casting' | 'Angling'
export let PlayerState: PlayerStates = 'Idle'
export const setPlayerState = (state: PlayerStates) => {
  PlayerState = state
  updateHud()
}

export const inputSystem: System = (world) => {
  buttonQueued = false
  if (button === null) return world
  if (GameState !== 'Playing' && button !== 'confirm') return world
  const previousState = PlayerState
  switch (button) {
    case 'cast':
      if (previousState === 'Idle') beginCast()
      if (previousState === 'Casting') confirmCast()
      // Should cutting line take a turn?
      if (previousState === 'Angling') cutLine()
      break
    case 'eat':
      if (previousState === 'Idle') {
        eatBait()
        WaitingForInput = false
      }
      break
    case 'wait':
      WaitingForInput = false
      break
    case 'confirm':
      if (previousState === 'Casting') confirmCast()
      if (GameState === 'Lost') {
        resetGame()
        return world
      }
      break
    case 'cancel':
      PlayerState = 'Idle'
      if (previousState === 'Casting') cancelCast()
      if (previousState === 'Angling') cutLine()
      break
    default:
      if (isNumber(button)) {
        if (previousState === 'Idle') toggleLure(button)
      } else {
        const move = DirectionGrids[DirectionNames.indexOf(button)]
        if (previousState === 'Casting') {
          moveCastTarget(move)
        } else if (previousState === 'Angling') {
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
  if (button !== null) {
    if (WaitingForInput) await onInput()
    else if (LoopState === 'AnimateEnemies') buttonQueued = true
  }
})
window.addEventListener('keyup', (e) => {
  if (!isGameKey(e.code)) return
  Keys.delete(e.code)
})

type Button =
  | typeof DirectionNames[number]
  | 'wait'
  | 'cast'
  | 'eat'
  | 'cancel'
  | 'confirm'
  | typeof numbers[number]
  | null
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
    case 'KeyE':
      return 'eat'
    case 'Escape':
      return 'cancel'
    case 'Space':
      return 'wait'
    case 'Enter':
      return 'confirm'
    case 'Digit1':
    case 'Numpad1':
      return 1
    case 'Digit2':
    case 'Numpad2':
      return 2
    case 'Digit3':
    case 'Numpad3':
      return 3
    case 'Digit4':
    case 'Numpad4':
      return 4
    case 'Digit5':
    case 'Numpad5':
      return 5
    case 'Digit6':
    case 'Numpad6':
      return 6
    case 'Digit7':
    case 'Numpad7':
      return 7
    case 'Digit8':
    case 'Numpad8':
      return 8
    case 'Digit9':
    case 'Numpad9':
      return 9
    case 'Digit0':
    case 'Numpad0':
      return 10
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
  'KeyE',
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
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'Numpad0',
] as const

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

function isNumber(button: Button): button is typeof numbers[number] {
  return numbers.includes(<typeof numbers[number]>button)
}
