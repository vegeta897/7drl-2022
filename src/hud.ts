import { Display } from 'rot-js'
import { Fish, Health, Wetness } from './ecs/components'
import { GameState, PlayerEntity } from './index'
import { PlayerState } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'
import { promisedFrame } from './pixi'

let HUD: Display
let log: string[]
let killedFish = 0

export enum Colors {
  White = '#ffffff',
  Good = '#14a02e',
  Bad = '#e86a73',
  Warning = '#f5a097',
  Danger = '#f57221',
  Dim = '#8098a1',
  Water = '#477d85',
  StrongWater = '#328e98',
  GoodWater = '#5daf8d',
  DeepWater = '#102b3b',
  Gold = '#ffd541',
  Blood = '#d01e2a',
  DeepestBlood = '#25141c',
  Sky = '#6bb9e1',
}

const hudDefaults = { width: 30, height: 32, fontSize: 20, bg: Colors.DeepWater }
const bigHudDefaults = { width: 44, height: 16, fontSize: 40, bg: Colors.DeepWater }

export function initHud() {
  HUD = new Display({ ...bigHudDefaults, fontStyle: 'bold' })
  HUD.drawText(19, 8, `%c{${Colors.Dim}}LOADING`)
  document.body.appendChild(HUD.getContainer()!)
  log = []
}

export function showLevelGen(attempt: number) {
  HUD.clear()
  HUD.drawText(8, 8, `%c{${Colors.Dim}}Level generation attempt #${attempt}`)
}

function getEntityName(entity: number, _capitalize = false) {
  let name = 'unknown'
  if (entity === PlayerEntity) name = 'you'
  if (hasComponent(World, Fish, entity)) name = 'the fish'
  return _capitalize ? capitalize(name) : name
}

export function logAttack(attacker: number, victim: number, damage: number) {
  let color = attacker === PlayerEntity ? Colors.Good : Colors.White
  if (victim === PlayerEntity) color = Colors.Bad
  logMessage(`${getEntityName(attacker, true)} hit ${getEntityName(victim)}: ${damage} dmg`, color)
}

export function logKill(victim: number) {
  if (hasComponent(World, Fish, victim)) killedFish++
  logMessage(`You killed ${getEntityName(victim)}`)
}

export function logMessage(message: string, color: Colors = Colors.White) {
  log.unshift(`%c{${color ?? ''}}${message}`)
  updateHud()
}

export function updateHud() {
  dirty = true
}

export function defaultHud() {
  HUD.clear()
  HUD.setOptions(hudDefaults)
  updateHud()
}

export function bigHud() {
  HUD.clear()
  HUD.setOptions(bigHudDefaults)
  updateHud()
}

const maxLogLines = 20
const lowestY = 32

let dirty = true

export async function drawHud() {
  if (!dirty) return
  dirty = false
  await promisedFrame()
  HUD.clear()
  if (GameState === 'Losing') return
  if (GameState === 'Lost') {
    HUD.setOptions({ ...bigHudDefaults, fontStyle: 'bold', bg: Colors.DeepestBlood })
    HUD.drawText(20, 7, `%c{${Colors.Blood}}GAME\nOVER`)
    return
  }
  if (GameState === 'Won') {
    HUD.setOptions(bigHudDefaults)
    HUD.drawText(
      7,
      4,
      `%c{${Colors.Sky}}At last, you made it back up to the dry, daylit surface\n\n\n\n\n\n%c{${Colors.GoodWater}}You killed ${killedFish} fish`,
      30
    )
    return
  }
  if (GameState === 'CriticalFailure') {
    HUD.setOptions(bigHudDefaults)
    HUD.drawText(
      9,
      6,
      `%c{${Colors.Blood}}Level generation failed\n after 1000 attempts\n\nReload the page to try again`
    )
    return
  }
  const health = Health.current[PlayerEntity]
  HUD.drawText(3, 1, `Health: %c{${health <= 3 ? Colors.Bad : ''}}${health.toString().padStart(3)}`)
  const wet = hasComponent(World, Wetness, PlayerEntity)
  HUD.drawText(24, 1, `%c{${wet ? Colors.StrongWater : Colors.Dim}}${wet ? 'Wet' : 'Dry'}`)
  if (PlayerState === 'Idle') HUD.drawText(3, 3, '[C] to cast')
  if (PlayerState === 'Casting') HUD.drawText(3, 3, 'CASTING ⟆\n\n[C] to confirm\n[Esc] to cancel')
  if (PlayerState === 'Angling') HUD.drawText(3, 3, 'ANGLING ⟆\n\n[C] to cut line')
  if (log.length > 0) {
    HUD.drawText(1, 8, '=========== LOG ===========')
    let y = 9
    for (let i = 0; i < log.length; i++) {
      y += HUD.drawText(
        2,
        y,
        log[i].replaceAll(
          /%c{#[a-z0-9]+/gi,
          '$&' +
            Math.round(Math.min(255, (maxLogLines - i) / maxLogLines) * 255)
              .toString(16)
              .padStart(2, '0')
        ),
        25
      )
      if (y >= lowestY) {
        log = log.slice(0, i + 1)
        break
      }
    }
  }
}

export function clearLog() {
  log = []
  updateHud()
}

const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1)
