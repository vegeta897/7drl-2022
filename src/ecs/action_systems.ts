// Do player or enemy actions
import {
  AnimateMovement,
  Bait,
  changeEntGrid,
  deleteEntGrid,
  Fish,
  getEntGrid,
  GridPosition,
  Health,
  MoveAction,
  SeekWater,
  Stunned,
  CanSwim,
  CanWalk,
  OnTileType,
  Wetness,
  Spotting,
  CalculateFOV,
} from './components'
import {
  defineQuery,
  System,
  addComponent,
  removeComponent,
  hasComponent,
  removeEntity,
  entityExists,
  Not,
} from 'bitecs'
import { EntityMap, Level } from '../level'
import { PlayerEntity, PlayerSprite, setGameState } from '../'
import { Log, logAttack, logKill } from '../hud'
import { addVector2, getDistance, getUnitVector2, Vector2, vectorsAreEqual } from '../vector2'
import { cutLine } from '../casting'
import { isWalkable, isWet, Tile } from '../map'
import { getTexture, SpritesByEID } from '../sprites'
import { FOV_RADIUS, RecalcEntities, VisibilityMap } from '../fov'
import { clamp } from 'rot-js/lib/util'

const moveQuery = defineQuery([GridPosition, MoveAction])
export const moveSystem: System = (world) => {
  for (const eid of moveQuery(world)) {
    const move = { x: MoveAction.x[eid], y: MoveAction.y[eid] }
    removeComponent(world, MoveAction, eid)
    const distance = getDistance(move)
    const unitMove = getUnitVector2(move)
    const startGrid = getEntGrid(eid)
    let currentGrid = startGrid
    let targetGrid: Vector2
    for (let i = 0; i < distance; i++) {
      targetGrid = addVector2(currentGrid, unitMove)
      const targetEntity = EntityMap.get(targetGrid)
      if (targetEntity !== undefined) {
        if (eid === PlayerEntity && OnTileType.current[eid] === Tile.Water) {
          Log.unshift(`You can't attack while swimming!`)
          break
        }
        const playerInvolved = [eid, targetEntity].includes(PlayerEntity)
        const attackedHasHealth = hasComponent(world, Health, targetEntity)
        if (playerInvolved && attackedHasHealth) {
          let damage = 1
          if (hasComponent(world, Stunned, targetEntity)) {
            damage = 5
            removeComponent(world, Stunned, targetEntity)
          }
          logAttack(eid, targetEntity, damage)
          const healthLeft = (Health.current[targetEntity] -= damage)
          if (healthLeft <= 0) {
            if (eid === PlayerEntity) logKill(targetEntity)
            deleteEntGrid(targetEntity)
            removeEntity(world, targetEntity)
          }
        }
        if (hasComponent(world, Bait, targetEntity)) {
          if (eid === PlayerEntity) Log.unshift('You ate the bait')
          if (hasComponent(world, Health, eid)) {
            Health.current[eid] = Math.min(Health.max[eid], Health.current[eid] + 1)
          }
          if (hasComponent(world, Fish, eid)) {
            addComponent(world, Stunned, eid)
            Stunned.remaining[eid] = 6
            cutLine()
            Log.unshift('The fish is eating the bait')
          }
          deleteEntGrid(targetEntity)
          removeEntity(world, targetEntity)
        } else {
          break
        }
      }
      const targetTile = Level.get(targetGrid)
      if (MoveAction.noclip[eid] === 0) {
        if (targetTile.solid) break
        let validTile = false
        if (hasComponent(world, CanSwim, eid) && isWet(targetTile.type)) validTile = true
        if (hasComponent(world, CanWalk, eid) && isWalkable(targetTile.type)) validTile = true
        if (!validTile) break
      }
      currentGrid = targetGrid
    }
    if (vectorsAreEqual(startGrid, currentGrid)) continue
    changeEntGrid(eid, currentGrid)
    if (hasComponent(world, OnTileType, eid)) {
      OnTileType.previous[eid] = OnTileType.current[eid]
      OnTileType.current[eid] = Level.get(currentGrid).type
    }
    if ((!VisibilityMap.has(startGrid) && !VisibilityMap.has(currentGrid)) || MoveAction.noclip[eid]) continue
    addComponent(world, AnimateMovement, eid)
    AnimateMovement.x[eid] = MoveAction.x[eid]
    AnimateMovement.y[eid] = MoveAction.y[eid]
    AnimateMovement.elapsed[eid] = 0
    AnimateMovement.length[eid] = 90 + 30 * distance
  }
  return world
}

const onTileTypeQuery = defineQuery([OnTileType, Not(Fish)])
export const wetnessSystem: System = (world) => {
  for (const eid of onTileTypeQuery(world)) {
    const prevWet = isWet(OnTileType.previous[eid])
    const nowWet = isWet(OnTileType.current[eid])
    if (!nowWet) {
      if (hasComponent(world, Wetness, eid)) {
        Wetness.factor[eid] -= 0.1
        if (Wetness.factor[eid] <= 0) {
          removeComponent(world, Wetness, eid)
          if (eid === PlayerEntity) Log.unshift('You are no longer wet')
        }
      }
      if (eid === PlayerEntity && prevWet) PlayerSprite.texture = getTexture('player')
    } else if (nowWet && !prevWet) {
      if (eid === PlayerEntity) {
        if (!hasComponent(world, Wetness, eid)) Log.unshift('You are wet')
        PlayerSprite.texture = getTexture('playerSwim')
      }
      addComponent(world, Wetness, eid)
      Wetness.factor[eid] = 1
    }
  }
  return world
}

const theFish = defineQuery([Fish, OnTileType])
export const fishSystem: System = (world) => {
  for (const eid of theFish(world)) {
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
      Spotting.current[eid] = newSpotting
      RecalcEntities.add(eid)
    }
    if (isWet(OnTileType.previous[eid]) === onWater) continue
    if (onWater) {
      SpritesByEID[eid].texture = getTexture('fishSwim')
      removeComponent(world, CanWalk, eid)
      removeComponent(world, SeekWater, eid)
    } else {
      SpritesByEID[eid].texture = getTexture('fish')
      addComponent(world, SeekWater, eid)
      SeekWater.distance[eid] = 6
    }
  }
  return world
}

export const gameSystem: System = (world) => {
  if (!entityExists(world, PlayerEntity)) {
    setGameState('Losing')
  }
  return world
}
