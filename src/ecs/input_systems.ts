import { addComponent, System } from 'bitecs'
import { LoopState, onInput, World } from './'
import { GameState, PlayerEntity, resetGame } from '../'
import { MoveAction } from './components'
import { DirectionGrids, DirectionNames } from '../vector2'
import { drawHud } from '../hud'
import { angleBait, beginCast, cancelCast, confirmCast, cutLine, moveCastTarget } from '../casting'

export const waitForInput = () => {
  WaitingForInput = true
  if (buttonQueued) onInput()
}
export const processInput = () => (WaitingForInput = false)
export let WaitingForInput = true

type PlayerStates = 'Idle' | 'Casting' | 'Angling'
export let PlayerState: PlayerStates = 'Idle'
export const setPlayerState = (state: PlayerStates) => (PlayerState = state)

export const inputSystem: System = (world) => {
  buttonQueued = false
  if (!button) return world
  if (GameState !== 'Playing' && button !== 'confirm') return world
  const previousState = PlayerState
  switch (button) {
    case 'cast':
      if (previousState === 'Idle') beginCast()
      if (previousState === 'Casting') confirmCast()
      if (previousState === 'Angling') cutLine()
      break
    case 'wait':
      WaitingForInput = false
      break
    case 'confirm':
      if (previousState === 'Casting') confirmCast()
      if (GameState === 'Lost') resetGame()
      break
    case 'exit':
      PlayerState = 'Idle'
      if (previousState === 'Casting') cancelCast()
      if (previousState === 'Angling') cutLine()
      break
    default:
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
    else if (LoopState === 'AnimateEnemies') buttonQueued = true
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
