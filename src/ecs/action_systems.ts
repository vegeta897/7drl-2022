// Do player or enemy actions
import {
  Airborne,
  AnimateMovement,
  AttackAction,
  Bait,
  CalculateFOV,
  CanAttack,
  CanSwim,
  CanWalk,
  changeEntGrid,
  Chest,
  deleteEntGrid,
  Exit,
  getEntGrid,
  Health,
  MoveAction,
  OnTileType,
  Predator,
  Spotting,
  Stunned,
  WaterCreature,
  Wetness,
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
import { Colors, logAttack, logBaiting, logKill, logMessage, updateHud } from '../hud'
import { addVector2, diffVector2, getDistance, getUnitVector2, Vector2, vectorsAreEqual } from '../vector2'
import { cutLine } from '../casting'
import { isWalkable, isWet, Tile } from '../map'
import { getTexture, SpritesByEID } from '../sprites'
import { FOV_RADIUS, RecalcEntities, VisibilityMap } from '../fov'
import { clamp } from 'rot-js/lib/util'
import { PixiViewport } from '../pixi'
import { filters } from 'pixi.js'
import { CreatureProps } from '../creatures'

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
      if (OnTileType.current[PlayerEntity] === Tile.Water) {
        logMessage(`You can't attack while swimming!`, Colors.Warning)
        return world
      }
      addComponent(world, AttackAction, PlayerEntity)
      AttackAction.target[PlayerEntity] = targetEntity
    } else if (hasComponent(world, Bait, targetEntity)) {
      logMessage('You ate the bait')
      Health.current[PlayerEntity] = Math.min(Health.max[PlayerEntity], Health.current[PlayerEntity] + 1)
      deleteEntGrid(targetEntity)
      removeEntity(world, targetEntity)
    } else if (hasComponent(world, Chest, targetEntity)) {
      logMessage('You got the chest!', Colors.Gold)
      deleteEntGrid(targetEntity)
      removeEntity(world, targetEntity)
    } else if (hasComponent(world, Exit, targetEntity)) {
      setGameState('EndLevel')
      removeComponent(world, MoveAction, PlayerEntity)
    }
  }
  if (MoveAction.noclip[PlayerEntity] === 0 && Level.get(targetGrid).solid)
    removeComponent(world, MoveAction, PlayerEntity)
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
        if (targetEntity === PlayerEntity) {
          addComponent(world, AttackAction, eid)
          AttackAction.target[eid] = targetEntity
          break
        } else if (hasComponent(world, Bait, targetEntity)) {
          if (hasComponent(world, Health, eid)) {
            Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + 1)
          }
          if (hasComponent(world, Predator, eid)) {
            addComponent(world, Stunned, eid)
            Stunned.remaining[eid] = Predator.baitStunTurns[eid]
            logBaiting(eid)
          }
          cutLine()
          deleteEntGrid(targetEntity)
          removeEntity(world, targetEntity)
          stopHere = true
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
      const newMove = diffVector2(startGrid, currentGrid)
      MoveAction.x[eid] = newMove.x
      MoveAction.y[eid] = newMove.y
    }
  }
  return world
}

export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const move = { x: MoveAction.x[eid], y: MoveAction.y[eid] }
    const myGrid = getEntGrid(eid)
    const targetGrid = addVector2(myGrid, move)
    changeEntGrid(eid, targetGrid)
    if (hasComponent(world, OnTileType, eid)) {
      OnTileType.previous[eid] = OnTileType.current[eid]
      OnTileType.current[eid] = Level.get(targetGrid).type
    }
    removeComponent(world, MoveAction, eid, false)
    if ((!VisibilityMap.has(myGrid) && !VisibilityMap.has(targetGrid)) || MoveAction.noclip[eid]) continue
    addComponent(world, AnimateMovement, eid)
    AnimateMovement.x[eid] = MoveAction.x[eid]
    AnimateMovement.y[eid] = MoveAction.y[eid]
    AnimateMovement.elapsed[eid] = 0
    AnimateMovement.length[eid] = 90 + 30 * getDistance(move)
  }
  return world
}

const attackQuery = defineQuery([AttackAction])
export const attackSystem: System = (world) => {
  for (const eid of attackQuery(world)) {
    const target = AttackAction.target[eid]
    let damage = CanAttack.damage[eid]
    if (hasComponent(world, Stunned, target)) {
      damage = 5
      removeComponent(world, Stunned, target)
    }
    logAttack(eid, target, damage)
    const healthLeft = (Health.current[target] -= damage)
    if (healthLeft <= 0) {
      logKill(target)
      deleteEntGrid(target)
      removeEntity(world, target)
    }
    removeComponent(world, AttackAction, eid)
  }
  return world
}

const onTileTypeQuery = defineQuery([OnTileType, Not(WaterCreature)])
export const wetnessSystem: System = (world) => {
  for (const eid of onTileTypeQuery(world)) {
    const prevWet = isWet(OnTileType.previous[eid])
    const nowWet = isWet(OnTileType.current[eid])
    if (!nowWet) {
      if (hasComponent(world, Wetness, eid)) {
        Wetness.factor[eid] -= 0.1
        if (Wetness.factor[eid] <= 0) {
          removeComponent(world, Wetness, eid)
          updateHud()
        }
      }
      if (eid === PlayerEntity && prevWet) PlayerSprite.texture = getTexture('player')
    } else if (nowWet && !prevWet) {
      if (eid === PlayerEntity) {
        if (!hasComponent(world, Wetness, eid)) updateHud()
        PlayerSprite.texture = getTexture('playerSwim')
      }
      addComponent(world, Wetness, eid)
      Wetness.factor[eid] = 1
    }
  }
  return world
}

const waterCreatures = defineQuery([WaterCreature, OnTileType])
export const waterCreatureSystem: System = (world) => {
  for (const eid of waterCreatures(world)) {
    const onWater = isWet(OnTileType.current[eid])
    const currentSpotting = Spotting.current[eid]
    let spotChange
    const fovDistance = CalculateFOV.distance[eid]
    if (fovDistance >= 0) {
      spotChange = (1 - fovDistance / FOV_RADIUS) * Spotting.increaseBy[eid]
      if (!onWater) spotChange = 1
    } else {
      spotChange = onWater ? -0.25 : 0
    }
    const newSpotting = clamp(currentSpotting + spotChange, 0, 2)
    if (newSpotting !== currentSpotting) {
      if (newSpotting >= 0.5 && newSpotting < 1 && currentSpotting < 0.5) {
        logMessage('You hear something in the water', Colors.StrongWater)
      }
      Spotting.current[eid] = newSpotting
      RecalcEntities.add(eid)
    }
    if (isWet(OnTileType.previous[eid]) === onWater) continue
    const texture = CreatureProps[WaterCreature.type[eid]].texture
    if (onWater) {
      SpritesByEID[eid].texture = getTexture(texture + 'Swim')
    } else {
      SpritesByEID[eid].texture = getTexture(texture)
    }
  }
  return world
}

const desaturated = new filters.ColorMatrixFilter()
desaturated.desaturate()

export const gameSystem: System = (world) => {
  if (GameState !== 'Losing' && !entityExists(world, PlayerEntity)) {
    PixiViewport.filters = [desaturated]
    setGameState('Losing')
  } else if (GameState === 'EndLevel') {
    if (CurrentLevel === LastLevel) {
      setGameState('Won')
    } else {
      nextLevel()
    }
  }
  return world
}
