import { Display } from 'rot-js'
import { Fish, Health } from './ecs/components'
import { GameState, PlayerEntity } from './index'
import { PlayerState } from './ecs/input_systems'
import { hasComponent } from 'bitecs'
import { World } from './ecs'

export let HUD: Display
let Log: string[]

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
}

export function initHud() {
  HUD = new Display({ width: 15, height: 16, fontSize: 40, fontStyle: 'bold', bg: '#102b3b' })
  HUD.drawText(4, 7, `%c{${Colors.Dim}}LOADING`)
  document.body.appendChild(HUD.getContainer()!)
  Log = []
}

export function resetHud() {
  HUD.setOptions(hudDefaults)
  Log = []
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
  logMessage(`You killed ${getEntityName(victim)}`)
}

export function logMessage(message: string, color: Colors = Colors.White) {
  Log.unshift(`%c{${color ?? ''}}${message}`)
}

const maxLogLines = 20
const lowestY = 32

export function drawHud() {
  HUD.clear()
  if (GameState === 'Losing') return
  if (GameState === 'Lost') {
    HUD.setOptions({ width: 15, height: 16, fontSize: 40 })
    HUD.drawText(5, 7, `%c{${Colors.Blood}}GAME OVER`, 4)
    return
  }
  const health = Health.current[PlayerEntity]
  HUD.drawText(3, 1, `Health: %c{${health <= 3 ? Colors.Bad : ''}}${health.toString().padStart(3)}`)
  if (PlayerState === 'Casting') HUD.drawText(3, 3, 'CASTING ⟆\n\nC to confirm\nEsc to cancel')
  if (PlayerState === 'Angling') HUD.drawText(3, 3, 'ANGLING ⟆\n\nC to cut line')
  if (Log.length > 0) {
    HUD.drawText(1, 8, '=========== LOG ===========')
    let y = 9
    for (let i = 0; i < Log.length; i++) {
      y += HUD.drawText(
        2,
        y,
        Log[i].replaceAll(
          /%c{#[a-z0-9]+/gi,
          '$&' +
            Math.round(Math.min(255, (maxLogLines - i) / maxLogLines) * 255)
              .toString(16)
              .padStart(2, '0')
        )
      )
      if (y >= lowestY) {
        Log = Log.slice(0, i + 1)
        break
      }
    }
  }
}

const capitalize = (str: string) => str[0].toUpperCase() + str.slice(1)
