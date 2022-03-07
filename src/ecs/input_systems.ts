import { addComponent, System } from 'bitecs'
import { onInput, World } from './'
import { CastTargetSprite, PlayerEntity, TILE_SIZE } from '../'
import { MoveAction } from './components'
import { addVector2, Down, getManhattanDistance, Left, Right, Up, Vector2, vectorsAreParallel } from '../vector2'
import { drawHud } from '../hud'

export const waitForInput = () => (WaitingForInput = true)
export let WaitingForInput = true

export let CastMode = false
export const CastVector = { x: 0, y: 0 }

export const inputSystem: System = (world) => {
  let move: Vector2 | null = null
  let cast = CastMode
  let wait = false
  switch (currentKey) {
    case 'KeyW':
    case 'KeyK':
    case 'ArrowUp':
      move = Up
      break
    case 'KeyS':
    case 'KeyJ':
    case 'ArrowDown':
      move = Down
      break
    case 'KeyA':
    case 'KeyH':
    case 'ArrowLeft':
      move = Left
      break
    case 'KeyD':
    case 'KeyL':
    case 'ArrowRight':
      move = Right
      break
    case 'KeyC':
      cast = !CastMode
      break
    case 'Escape':
      cast = false
      break
    case 'Space':
      wait = true
      break
    case 'Enter':
      break
  }
  if (cast && !CastMode) {
    CastMode = true
    CastVector.x = 0
    CastVector.y = 0
    CastTargetSprite.x = 0
    CastTargetSprite.y = 0
    CastTargetSprite.visible = true
  } else if (!cast && CastMode) {
    CastMode = false
    CastTargetSprite.visible = false
  }
  if (move !== null) {
    if (CastMode) {
      const castTo = addVector2(CastVector, move)
      for (const mod of [{ x: 0, y: 0 }, Up, Down, Left, Right]) {
        if (vectorsAreParallel(mod, move)) continue
        const moddedCastTo = addVector2(castTo, mod)
        if (getManhattanDistance(moddedCastTo) <= 4) {
          CastVector.x = moddedCastTo.x
          CastVector.y = moddedCastTo.y
          CastTargetSprite.x = CastVector.x * TILE_SIZE
          CastTargetSprite.y = CastVector.y * TILE_SIZE
          break
        }
      }
    } else {
      const boost = Keys.has('ControlLeft') || Keys.has('ControlRight')
      const noclip = Keys.has('ShiftLeft') || Keys.has('ShiftRight')
      addComponent(World, MoveAction, PlayerEntity)
      MoveAction.x[PlayerEntity] = move.x * (boost ? 10 : 1)
      MoveAction.y[PlayerEntity] = move.y * (boost ? 10 : 1)
      MoveAction.noclip[PlayerEntity] = noclip || boost ? 1 : 0
      WaitingForInput = false
    }
  } else if (wait) {
    WaitingForInput = false
  }
  drawHud()
  return world
}

const Keys: Set<GameKey> = new Set()
let currentKey: null | GameKey = null

const isGameKey = (key: string): key is GameKey => gameKeys.includes(key as GameKey)

window.addEventListener('keydown', async (e) => {
  if (e.repeat) return
  if (!isGameKey(e.code)) return
  e.preventDefault()
  Keys.add(e.code)
  currentKey = e.code
  if (WaitingForInput) await onInput()
})
window.addEventListener('keyup', (e) => {
  if (!isGameKey(e.code)) return
  Keys.delete(e.code)
  currentKey = null
})

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
