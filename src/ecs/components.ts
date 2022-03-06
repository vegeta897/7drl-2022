import { ComponentType, defineComponent, Types } from 'bitecs'

export const DisplayObject = defineComponent()

const GridC = {
  x: Types.i32,
  y: Types.i32,
}

export const GridPosition = defineComponent({ ...GridC })

export const MoveAction = defineComponent({ ...GridC, clip: Types.i8 })

export const AnimateMovement = defineComponent({
  ...GridC,
  elapsed: Types.f32,
  length: Types.f32,
})

export const RandomWalk = defineComponent()

export const ActionTimer = defineComponent({
  timeLeft: Types.ui16,
})

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
