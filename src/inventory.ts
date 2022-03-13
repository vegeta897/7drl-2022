import { addScore, Colors, logMessage, updateHud } from './hud'
import { deleteEntGrid, Health, Loot } from './ecs/components'
import { removeEntity } from 'bitecs'
import { World } from './ecs'
import { RNG } from 'rot-js'
import { PlayerEntity } from './'

export const Supplies = {
  bait: 0,
  lineLength: 0,
}

export const Inventory: Set<Lure> = new Set()
export const ActiveLures: Set<Lure> = new Set()

export enum Lure {
  WreckingBall = 1,
  MagicSponge,
  SecondSight,
  Telecasting,
}
const lures = [Lure.WreckingBall, Lure.MagicSponge, Lure.SecondSight, Lure.Telecasting]

export function getLureInfo(lure: Lure): { name: string; color: Colors } {
  switch (lure) {
    case Lure.WreckingBall:
      return { name: 'Wrecking Ball', color: Colors.Danger }
    case Lure.MagicSponge:
      return { name: 'Magic Sponge', color: Colors.Sponge }
    case Lure.SecondSight:
      return { name: 'Second Sight', color: Colors.Mystical }
    case Lure.Telecasting:
      return { name: 'Telecasting', color: Colors.Spooky }
  }
}

export enum LootType {
  Bag = 1,
  Chest,
}

const bagLootChances = {
  bait: 4,
  extraLine: 1,
}

const chestLootChances = {
  bait: 1,
  extraLine: 1,
  lure: 8,
}

export function getLoot(eid: number) {
  const lootType = Loot.type[eid]
  let loot: string
  do {
    loot = RNG.getWeightedValue(lootType === LootType.Chest ? chestLootChances : bagLootChances)!
  } while (Inventory.size === lures.length && loot === 'lure')
  if (loot === 'bait') {
    let baitAmount = Math.max(1, Math.round(RNG.getNormal(7, 2.5)))
    if (lootType === LootType.Chest) baitAmount *= 2
    Supplies.bait += baitAmount
    addScore(20)
    logMessage(`You picked up ${baitAmount} bait`, Colors.White)
  } else if (loot === 'extraLine') {
    Supplies.lineLength++
    if (lootType === LootType.Chest) Supplies.lineLength++
    addScore(30)
    logMessage(`You picked up some extra fishing line`, Colors.White)
  } else if (loot === 'lure') {
    const lure = RNG.getItem(lures.filter((l) => !Inventory.has(l)))!
    Inventory.add(lure)
    const { color, name } = getLureInfo(lure)
    addScore(250)
    let info = Inventory.size === 1 ? ' Use the number keys to attach lures' : ''
    info = Inventory.size === 2 ? ' Tip: Multiple lures can be attached at once!' : info
    logMessage(`You found the %c{${color}}${name} lure!%c{${Colors.White}}${info}`, Colors.White)
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

export function eatBait() {
  if (Supplies.bait === 0) return
  if (Health.current[PlayerEntity] === Health.max[PlayerEntity]) {
    logMessage(`You already have max health`)
    return
  }
  Supplies.bait--
  logMessage('You ate 1 bait (+1 hp)', Colors.GoodWater)
  Health.current[PlayerEntity]++
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
