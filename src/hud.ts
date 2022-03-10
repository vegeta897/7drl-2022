import { Display } from 'rot-js'
import { Fish, Health } from './ecs/components'
import { GameState, PlayerEntity } from './index'
import { PlayerState } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'

export let HUD: Display
let log: string[]
let killedFish = 0

const hudDefaults = { width: 30, height: 32, fontSize: 20 }

export enum Colors {
  White = '#ffffff',
  Good = '#14a02e',
  Bad = '#e86a73',
  Warning = '#f5a097',
  Danger = '#f57221',
  Dim = '#8098a1',
  Water = '#477d85',
  GoodWater = '#5daf8d',
  Gold = '#ffd541',
  Blood = '#d01e2a',
  Sky = '#6bb9e1',
}

export function initHud() {
  HUD = new Display({ width: 15, height: 16, fontSize: 40, fontStyle: 'bold', bg: '#102b3b' })
  HUD.drawText(4, 7, `%c{${Colors.Dim}}LOADING`)
  document.body.appendChild(HUD.getContainer()!)
  log = []
}

export function resetHud() {
  HUD.setOptions(hudDefaults)
  log = []
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
  logMessage(`${getEntityName(attacker, true)} hit ${getEntityName(victim)} for ${damage} dmg`, color)
}

export function logKill(victim: number) {
  if (hasComponent(World, Fish, victim)) killedFish++
  logMessage(`You killed ${getEntityName(victim)}`)
}

export function logMessage(message: string, color: Colors = Colors.White) {
  log.unshift(`%c{${color ?? ''}}${message}`)
}

const maxLogLines = 20
const lowestY = 32

export function drawHud() {
  HUD.clear()
  if (GameState === 'Losing') return
  if (GameState === 'Lost') {
    HUD.setOptions({ width: 15, height: 16, fontSize: 40 })
    HUD.drawText(5, 7, `%c{${Colors.Blood}}GAME\nOVER`)
    return
  }
  if (GameState === 'Won') {
    HUD.setOptions({ width: 44, height: 16, fontSize: 40 })
    HUD.drawText(
      7,
      4,
      `%c{${Colors.Sky}}At last, you made it back up to the dry, daylit surface\n\n\n\n\n\n%c{${Colors.GoodWater}}You killed ${killedFish} fish`,
      30
    )
    return
  }
  if (GameState === 'CriticalFailure') {
    HUD.setOptions({ width: 44, height: 16, fontSize: 40 })
    HUD.drawText(
      9,
      6,
      `%c{${Colors.Blood}}Level generation failed\n after 500 attempts\n\nReload the page to try again`
    )
    return
  }
  const health = Health.current[PlayerEntity]
  HUD.drawText(3, 1, `Health: %c{${health <= 3 ? Colors.Bad : ''}}${health.toString().padStart(3)}`)
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
        )
      )
      if (y >= lowestY) {
        log = log.slice(0, i + 1)
        break
      }
    }
  }
}

const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1)
