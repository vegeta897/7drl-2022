// Do player or enemy actions
import {
  Airborne,
  Animate,
  AttackAction,
  Bait,
  CalculateFOV,
  CanAttack,
  CanSwim,
  CanWalk,
  changeEntGrid,
  Loot,
  deleteEntGrid,
  Exit,
  getEntGrid,
  Health,
  MoveAction,
  NoAction,
  OnTileType,
  Predator,
  Spotting,
  Statuses,
  WaterCreature,
  Wetness,
  Snail,
  Mushroom,
} from './components'
import {
  addComponent,
  defineQuery,
  entityExists,
  hasComponent,
  Not,
  removeComponent,
  removeEntity,
  System,
} from 'bitecs'
import { EntityMap, Level } from '../level'
import { CurrentLevel, GameState, LastLevel, nextLevel, PlayerEntity, PlayerSprite, setGameState } from '../'
import { addScore, Colors, logAttack, logBaitEat, logKill, logMessage, logPetting, updateHud } from '../hud'
import { addVector2, diffVector2, getDistance, getUnitVector2, Vector2, vectorsAreEqual } from '../vector2'
import { BaitEntity, cutLine, spawnBait } from '../casting'
import { isWalkable, isWet, Tile } from '../map'
import { getTexture, SpritesByEID } from '../sprites'
import { FOV_RADIUS, RecalcEntities, RevealedTiles, VisibilityMap } from '../fov'
import { clamp } from 'rot-js/lib/util'
import { PixiViewport } from '../pixi'
import { AnimatedSprite, filters } from 'pixi.js'
import { changeAnimation, Creature } from '../creatures'
import { World } from './'
import { getLoot, Supplies } from '../inventory'
import { AnimationType } from '../animation'
import { RNG } from 'rot-js'

export const playerActionSystem: System = (world) => {
  if (!hasComponent(world, MoveAction, PlayerEntity)) return world
  const myGrid = getEntGrid(PlayerEntity)
  const move = { x: MoveAction.x[PlayerEntity], y: MoveAction.y[PlayerEntity] }
  const targetGrid = addVector2(myGrid, move)
  const targetEntity = EntityMap.get(targetGrid)
  if (targetEntity !== undefined) {
    const targetHasHealth = hasComponent(world, Health, targetEntity)
    if (targetHasHealth) {
      removeComponent(world, MoveAction, PlayerEntity)
      if (Level.get(myGrid).type === Tile.Water) {
        logMessage(`You can't attack while swimming!`, Colors.Warning)
        return world
      }
      addComponent(world, AttackAction, PlayerEntity)
      AttackAction.target[PlayerEntity] = targetEntity
      AttackAction.x[PlayerEntity] = move.x
      AttackAction.y[PlayerEntity] = move.y
    } else if (hasComponent(world, Bait, targetEntity)) {
      Supplies.bait++
      logMessage('You picked up the bait', Colors.Dim)
      if (Bait.waterVolume[targetEntity!] > 0) Level.floodTile(targetGrid, Bait.waterVolume[targetEntity!])
      deleteEntGrid(targetEntity)
      removeEntity(world, targetEntity)
    } else if (hasComponent(world, Loot, targetEntity)) {
      getLoot(targetEntity)
    } else if (hasComponent(world, Mushroom, targetEntity)) {
      logMessage('You ate the mushroom (+1 hp)', Colors.GoodWater)
      addScore(50)
      Health.current[PlayerEntity]++
      Health.max[PlayerEntity] = Math.max(Health.max[PlayerEntity], Health.current[PlayerEntity])
      deleteEntGrid(targetEntity)
      removeEntity(world, targetEntity)
    } else if (hasComponent(world, Exit, targetEntity)) {
      setGameState('EndLevel')
      addScore(1000 * CurrentLevel)
      removeComponent(world, MoveAction, PlayerEntity)
    } else if (
      hasComponent(world, WaterCreature, targetEntity) &&
      WaterCreature.type[targetEntity] === Creature.Turtle
    ) {
      logPetting()
      removeComponent(world, MoveAction, PlayerEntity)
    } else {
      removeComponent(world, MoveAction, PlayerEntity)
    }
  }
  if (MoveAction.noclip[PlayerEntity] === 0 && Level.get(targetGrid).solid) {
    removeComponent(world, MoveAction, PlayerEntity)
  }
  if (hasComponent(World, MoveAction, PlayerEntity)) moveEntity(PlayerEntity, move)
  return world
}

const moveQuery = defineQuery([MoveAction])
export const enemyActionSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    if (eid === PlayerEntity) continue
    const move = { x: MoveAction.x[eid], y: MoveAction.y[eid] }
    const distance = getDistance(move)
    const unitMove = getUnitVector2(move)
    const startGrid = getEntGrid(eid)
    let currentGrid = startGrid
    let targetGrid: Vector2
    for (let i = 0; i < distance; i++) {
      let stopHere = false
      targetGrid = addVector2(currentGrid, unitMove)
      const targetEntity = EntityMap.get(targetGrid)
      if (targetEntity !== undefined) {
        if (targetEntity === PlayerEntity && hasComponent(world, CanAttack, eid)) {
          addComponent(world, AttackAction, eid)
          AttackAction.target[eid] = targetEntity
          AttackAction.x[eid] = move.x
          AttackAction.y[eid] = move.y
          break
        } else if (hasComponent(world, Bait, targetEntity)) {
          if (hasComponent(world, Predator, eid)) {
            logBaitEat(eid)
            addComponent(world, NoAction, eid)
            NoAction.status[eid] = Statuses.Eating
            NoAction.remaining[eid] = Predator.eatingTurns[eid]
          }
          if (Bait.waterVolume[targetEntity!] > 0) Level.floodTile(targetGrid, Bait.waterVolume[targetEntity!])
          cutLine()
          deleteEntGrid(targetEntity)
          removeEntity(world, targetEntity)
          stopHere = true
        } else {
          break
        }
      }
      const targetTile = Level.get(targetGrid)
      let validTile = false
      if (hasComponent(world, Airborne, eid)) validTile = !Level.get(targetGrid).solid
      if (hasComponent(world, CanSwim, eid) && isWet(targetTile.type)) validTile = true
      if (hasComponent(world, CanWalk, eid) && isWalkable(targetTile.type)) validTile = true
      if (!validTile) break
      currentGrid = targetGrid
      if (stopHere) break
    }
    removeComponent(world, Airborne, eid)
    if (vectorsAreEqual(startGrid, currentGrid)) {
      removeComponent(world, MoveAction, eid)
    } else {
      const tileType = Level.get(currentGrid).type
      if (hasComponent(world, CanSwim, eid) && isWet(tileType)) CanSwim.slowTurns[eid] = CanSwim.slowness[eid]
      if (hasComponent(world, CanWalk, eid) && isWalkable(tileType)) CanWalk.slowTurns[eid] = CanWalk.slowness[eid]
      moveEntity(eid, diffVector2(startGrid, currentGrid))
    }
  }
  return world
}

function moveEntity(eid: number, move: Vector2) {
  const myGrid = getEntGrid(eid)
  const targetGrid = addVector2(myGrid, move)
  changeEntGrid(eid, targetGrid)
  let swimming = false
  if (isWet(Level.get(myGrid).type) && isWet(Level.get(targetGrid).type)) swimming = true

  removeComponent(World, MoveAction, eid, false)
  if ((eid !== PlayerEntity && !VisibilityMap.has(myGrid) && !VisibilityMap.has(targetGrid)) || MoveAction.noclip[eid])
    return
  const distance = getDistance(move)
  addComponent(World, Animate, eid)
  if (hasComponent(World, AttackAction, eid) || distance > 1) {
    Animate.type[eid] = hasComponent(World, AttackAction, eid) ? AnimationType.LungeAttack : AnimationType.Lunge
  } else {
    Animate.type[eid] = swimming ? AnimationType.Swim : AnimationType.Hop
  }
  Animate.x[eid] = move.x
  Animate.y[eid] = move.y
  Animate.isMovement[eid] = 1
  Animate.elapsed[eid] = 0
  Animate.length[eid] = (swimming ? 200 : 100) + 40 * distance
}

const attackQuery = defineQuery([AttackAction])
export const attackSystem: System = (world) => {
  for (const eid of attackQuery(world)) {
    const distance = getDistance({ x: AttackAction.x[eid], y: AttackAction.y[eid] })
    if (distance > 1) console.log('its a lunge')
    const target = AttackAction.target[eid]
    let damage = CanAttack.damage[eid]
    if (RNG.getUniform() > (distance > 1 ? 0.3 : 0.8)) damage += RNG.getUniformInt(1, CanAttack.maxAdditional[eid])
    let stunnedByAttack = false
    const wasEating = NoAction.status[target] === Statuses.Eating
    if (hasComponent(world, NoAction, target)) {
      damage += 1
      if (wasEating) {
        damage += 2
        stunnedByAttack = true
        NoAction.status[target] = Statuses.Stunned
        NoAction.remaining[target] = 1
      }
    }
    const healthLeft = (Health.current[target] -= damage)
    if (healthLeft <= 0) {
      logAttack(eid, target, damage)
      logKill(target)
      const targetGrid = getEntGrid(target)
      deleteEntGrid(target)
      removeEntity(world, target)
      if (wasEating && RNG.getUniform() > 0.5) {
        logMessage('The bait can be used again!', Colors.GoodWater)
        spawnBait(targetGrid)
      }
    } else {
      logAttack(eid, target, damage, stunnedByAttack ? `, %c{${Colors.Warning}}stunning it` : '')
    }
    if (!hasComponent(world, Animate, eid)) {
      addComponent(World, Animate, eid)
      Animate.type[eid] = AnimationType.Attack
      Animate.isMovement[eid] = 0
      Animate.x[eid] = AttackAction.x[eid]
      Animate.y[eid] = AttackAction.y[eid]
      Animate.elapsed[eid] = 0
      Animate.length[eid] = 180
    }
    removeComponent(world, AttackAction, eid)
  }
  return world
}

const onTileTypeQuery = defineQuery([OnTileType, Not(WaterCreature)])
export const wetnessSystem: System = (world) => {
  for (const eid of onTileTypeQuery(world)) {
    const currentTile = Level.get(getEntGrid(eid)).type
    const noPrevious = OnTileType.previous[eid] === 0
    OnTileType.previous[eid] = OnTileType.current[eid]
    OnTileType.current[eid] = currentTile
    const prevWet = isWet(OnTileType.previous[eid])
    const nowWet = isWet(currentTile)
    if (!nowWet) {
      if (hasComponent(world, Wetness, eid)) {
        Wetness.factor[eid] -= 0.1
        if (Wetness.factor[eid] <= 0) removeComponent(world, Wetness, eid)
        updateHud()
      }
      if (eid === PlayerEntity && prevWet) {
        PlayerSprite.texture = getTexture('player')
      } else if (eid === BaitEntity) {
        SpritesByEID[eid!].texture = getTexture('bait')
      }
    } else if (nowWet && (!prevWet || noPrevious)) {
      if (eid === PlayerEntity) {
        if (!hasComponent(world, Wetness, eid)) updateHud()
        if (!hasComponent(world, Animate, eid)) PlayerSprite.texture = getTexture('playerSwim')
      } else if (eid === BaitEntity) {
        SpritesByEID[eid!].texture = getTexture('baitWater')
      }
      addComponent(world, Wetness, eid)
      Wetness.factor[eid] = 1
      if (hasComponent(world, Snail, eid) && Level.get(getEntGrid(eid)).type === Tile.Water) {
        logMessage('The giant snail has drowned!', Colors.GoodWater)
        addScore(100) // You cruel bastard
        deleteEntGrid(eid)
        removeEntity(world, eid)
      }
    }
  }
  return world
}

const waterCreatures = defineQuery([WaterCreature, OnTileType])
export const waterCreatureSystem: System = (world) => {
  for (const eid of waterCreatures(world)) {
    const currentTile = Level.get(getEntGrid(eid)).type
    const noPrevious = OnTileType.previous[eid] === 0
    OnTileType.previous[eid] = OnTileType.current[eid]
    OnTileType.current[eid] = currentTile
    const prevWet = isWet(OnTileType.previous[eid])
    const nowWet = isWet(currentTile)
    const currentSpotting = Spotting.current[eid]
    let spotChange
    const fovDistance = CalculateFOV.distance[eid]
    if (fovDistance >= 0) {
      spotChange = (1 - fovDistance / FOV_RADIUS) * Spotting.increaseBy[eid]
      if (!nowWet) spotChange = 1
    } else {
      spotChange = nowWet ? -0.25 : 0
    }
    const newSpotting = clamp(currentSpotting + spotChange, 0, 2)
    if (newSpotting !== currentSpotting) {
      if (newSpotting >= 0.5 && newSpotting < 1 && currentSpotting < 0.5) {
        logMessage('You hear something in the water', Colors.StrongWater)
      }
      Spotting.current[eid] = newSpotting
      RecalcEntities.add(eid)
    }
    if (prevWet === nowWet && !noPrevious) continue
    if (nowWet && (!prevWet || noPrevious)) {
      if (!hasComponent(world, Animate, eid))
        changeAnimation(<AnimatedSprite>SpritesByEID[eid], WaterCreature.type[eid], true)
    } else {
      changeAnimation(<AnimatedSprite>SpritesByEID[eid], WaterCreature.type[eid])
    }
  }
  return world
}

const desaturated = new filters.ColorMatrixFilter()
desaturated.desaturate()
desaturated.alpha = 0.3

export const gameSystem: System = (world) => {
  if (GameState !== 'Losing' && !entityExists(world, PlayerEntity)) {
    PixiViewport.filters = [desaturated]
    addScore(Math.floor(RevealedTiles.size / 10))
    setGameState('Losing')
  } else if (GameState === 'EndLevel') {
    addScore(Math.floor(RevealedTiles.size / 10))
    if (CurrentLevel === LastLevel) {
      setGameState('Won')
    } else {
      nextLevel()
    }
  }
  return world
}
