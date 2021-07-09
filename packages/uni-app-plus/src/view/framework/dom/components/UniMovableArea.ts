import '@dcloudio/uni-components/style/movable-area.css'
import { MovableArea } from '@dcloudio/uni-components'

import { UniComponent } from './UniComponent'

export class UniMovableArea extends UniComponent {
  constructor(id: number) {
    super(id, 'uni-movable-area', MovableArea)
  }
}
