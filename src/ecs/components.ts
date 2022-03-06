import { ComponentType, defineComponent, Types } from 'bitecs'

export const Player = defineComponent()

export const DisplayObject = defineComponent()

const GridC = {
  x: Types.i32,
  y: Types.i32,
}

export const GridPosition = defineComponent({ ...GridC })

export const MoveAction = defineComponent({ ...GridC, noclip: Types.i8 })

export const AnimateMovement = defineComponent({
  ...GridC,
  elapsed: Types.f32,
  length: Types.f32,
})

export const ActionTimer = defineComponent({
  timeLeft: Types.ui16,
})

export const Health = defineComponent({ current: Types.ui16, max: Types.ui16 })
export const Walker = defineComponent()
export const Swimmer = defineComponent()
export const Wander = defineComponent({ chance: Types.ui8, maxChance: Types.ui8 })
export const SensePlayer = defineComponent({ range: Types.ui8 })
export const Lunge = defineComponent({ power: Types.ui8, direction: Types.ui8 })

class GridProxy {
  private store: ComponentType<typeof GridC>
  eid: number
  constructor(store: ComponentType<typeof GridC>, eid: number) {
    this.eid = eid
    this.store = store
  }
  get x() {
    return this.store.x[this.eid]
  }
  set x(val) {
    this.store.x[this.eid] = val
  }
  get y() {
    return this.store.y[this.eid]
  }
  set y(val) {
    this.store.y[this.eid] = val
  }
}

export class GridPositionProxy extends GridProxy {
  constructor(eid: number) {
    super(GridPosition, eid)
  }
}

export class MoveActionProxy extends GridProxy {
  constructor(eid: number) {
    super(GridPosition, eid)
  }
}

export class AnimateMovementProxy extends GridProxy {
  constructor(eid: number) {
    super(GridPosition, eid)
  }
}
