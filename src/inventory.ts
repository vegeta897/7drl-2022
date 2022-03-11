import { Colors, logMessage, updateHud } from './hud'
import { deleteEntGrid } from './ecs/components'
import { removeEntity } from 'bitecs'
import { World } from './ecs'
import { RNG } from 'rot-js'

export const Supplies = {
  bait: 0,
  lineLength: 0,
}

export const Inventory: Set<Lure> = new Set()
export const ActiveLures: Set<Lure> = new Set()

export enum Lure {
  WreckingBall = 1,
  MagicSponge, // TODO: Pour out collected water when reeled in or eaten, use nearest-first crawl to fill tiles
}
const lures = [Lure.WreckingBall, Lure.MagicSponge]

export function getLureInfo(lure: Lure): { name: string; color: Colors } {
  switch (lure) {
    case Lure.WreckingBall:
      return { name: 'Wrecking Ball', color: Colors.Danger }
    case Lure.MagicSponge:
      return { name: 'Magic Sponge', color: Colors.Gold }
  }
}

const lootChances = {
  bait: 4,
  extraLine: 1,
  lure: 100,
}

export function openChest(eid: number) {
  let loot: string
  do {
    loot = RNG.getWeightedValue(lootChances)!
  } while (Inventory.size === lures.length && loot === 'lure')
  if (loot === 'bait') {
    const baitAmount = Math.max(1, Math.round(RNG.getNormal(7, 2.5)))
    Supplies.bait += baitAmount
    logMessage(`You got ${baitAmount} bait`, Colors.White)
  } else if (loot === 'extraLine') {
    Supplies.lineLength++
    logMessage(`You got some extra fishing line`, Colors.White)
  } else if (loot === 'lure') {
    const lure = RNG.getItem([Lure.WreckingBall, Lure.MagicSponge].filter((l) => !Inventory.has(l)))!
    Inventory.add(lure)
    const { color, name } = getLureInfo(lure)
    let info = Inventory.size === 1 ? ' Use the number keys to activate lures' : ''
    info = Inventory.size === 2 ? ' Tip: Multiple lures can be activated at once!' : info
    logMessage(`You got the %c{${color}}${name} lure!%c{${Colors.White}}${info}`, Colors.White)
  }
  deleteEntGrid(eid)
  removeEntity(World, eid)
}

export function toggleLure(lure: number) {
  const toToggle = [...Inventory][lure - 1]
  if (!toToggle) return
  if (ActiveLures.has(toToggle)) ActiveLures.delete(toToggle)
  else ActiveLures.add(toToggle)
  updateHud()
}

export function getPlayerDamage() {
  let damage = 1
  if (Inventory.has(Lure.WreckingBall)) damage = 2
  return damage
}

export function clearInventory() {
  Supplies.bait = 8
  Supplies.lineLength = 4
  Inventory.clear()
  ActiveLures.clear()
}
