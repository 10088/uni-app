import {
  onMounted,
  reactive,
  Ref,
  ref,
  watch,
  SetupContext,
  PropType,
  provide,
} from 'vue'
import {
  defineBuiltInComponent,
  useSubscribe,
  useCustomEvent,
} from '@dcloudio/uni-components'
import { callback } from '../../../helpers/utils'
import { QQMapsExt, loadMaps } from './qqMap'
import { Map } from './qqMap/types'
import MapMarker, {
  Props as MapMarkerProps,
  Context as MapMarkerContext,
} from './MapMarker'
import MapPolyline, { Props as MapPolylineProps } from './MapPolyline'
import MapCircle, { Props as MapCircleProps } from './MapCircle'
import MapControl, { Props as MapControlProps } from './MapControl'
import MapLocation, {
  Context as MapLocationContext,
  CONTEXT_ID as MAP_LOCATION_CONTEXT_ID,
} from './MapLocation'

interface Point {
  latitude: number
  longitude: number
}

const props = {
  id: {
    type: String,
    default: '',
  },
  latitude: {
    type: [String, Number],
    default: 39.90374,
  },
  longitude: {
    type: [String, Number],
    default: 116.397827,
  },
  scale: {
    type: [String, Number],
    default: 16,
  },
  markers: {
    type: Array as PropType<MapMarkerProps[]>,
    default() {
      return []
    },
  },
  includePoints: {
    type: Array as PropType<Point[]>,
    default() {
      return []
    },
  },
  polyline: {
    type: Array as PropType<MapPolylineProps[]>,
    default() {
      return []
    },
  },
  circles: {
    type: Array as PropType<MapCircleProps[]>,
    default() {
      return []
    },
  },
  controls: {
    type: Array as PropType<MapControlProps[]>,
    default() {
      return []
    },
  },
  showLocation: {
    type: [Boolean, String],
    default: false,
  },
}

type Props = Record<keyof typeof props, any>
interface MapState {
  latitude: number
  longitude: number
  includePoints: Point[]
}

function getPoints(points: Point[]): Point[] {
  const newPoints: Point[] = []
  if (Array.isArray(points)) {
    points.forEach((point) => {
      if (point && point.latitude && point.longitude) {
        newPoints.push({
          latitude: point.latitude,
          longitude: point.longitude,
        })
      }
    })
  }
  return newPoints
}

function useMap(
  props: Props,
  rootRef: Ref<HTMLElement | null>,
  emit: SetupContext['emit']
) {
  const trigger = useCustomEvent(rootRef, emit)
  const mapRef: Ref<HTMLDivElement | null> = ref(null)
  let maps: QQMapsExt
  let map: Map
  const state: MapState = reactive({
    latitude: Number(props.latitude),
    longitude: Number(props.longitude),
    includePoints: getPoints(props.includePoints),
  })
  type CustomEventTrigger = ReturnType<typeof useCustomEvent>
  type OnMapReadyCallback = (
    map: Map,
    maps: QQMapsExt,
    trigger: CustomEventTrigger
  ) => void
  const onMapReadyCallbacks: OnMapReadyCallback[] = []
  let isMapReady: boolean
  function onMapReady(callback: OnMapReadyCallback) {
    if (isMapReady) {
      callback(map, maps, trigger)
    } else {
      onMapReadyCallbacks.push(callback)
    }
  }
  function emitMapReady() {
    isMapReady = true
    onMapReadyCallbacks.forEach((callback) => callback(map, maps, trigger))
    onMapReadyCallbacks.length = 0
  }
  let isBoundsReady: boolean
  type OnBoundsReadyCallback = () => void
  const onBoundsReadyCallbacks: OnBoundsReadyCallback[] = []
  function onBoundsReady(callback: OnBoundsReadyCallback) {
    if (isBoundsReady) {
      callback()
    } else {
      onMapReadyCallbacks.push(callback)
    }
  }
  const contexts: Record<string, MapMarkerContext | MapLocationContext> = {}
  function addMapChidlContext(context: MapMarkerContext | MapLocationContext) {
    contexts[context.id] = context
  }
  function removeMapChidlContext(
    context: MapMarkerContext | MapLocationContext
  ) {
    delete contexts[context.id]
  }
  watch(
    [() => props.latitude, () => props.longitude],
    ([latitudeVlaue, longitudeVlaue]) => {
      const latitude = Number(latitudeVlaue)
      const longitude = Number(longitudeVlaue)
      if (latitude !== state.latitude || longitude !== state.longitude) {
        state.latitude = latitude
        state.longitude = longitude
        if (map) {
          map.setCenter(new maps.LatLng(latitude, longitude))
        }
      }
    }
  )
  watch(
    () => props.includePoints,
    (points) => {
      state.includePoints = getPoints(points)
      if (isBoundsReady) {
        updateBounds()
      }
    },
    {
      deep: true,
    }
  )
  function emitBoundsReady() {
    isBoundsReady = true
    onBoundsReadyCallbacks.forEach((callback) => callback())
    onBoundsReadyCallbacks.length = 0
  }
  function getMapInfo() {
    const center = map.getCenter()
    return {
      scale: map.getZoom(),
      centerLocation: {
        latitude: center.getLat(),
        longitude: center.getLng(),
      },
    }
  }
  function updateCenter() {
    map.setCenter(new maps.LatLng(state.latitude, state.longitude))
  }
  function updateBounds() {
    const bounds = new maps.LatLngBounds()
    state.includePoints.forEach(({ latitude, longitude }) => {
      const latLng = new maps.LatLng(latitude, longitude)
      bounds.extend(latLng)
    })
    map.fitBounds(bounds)
  }
  function initMap() {
    const mapEl = mapRef.value as HTMLDivElement
    const center = new maps.LatLng(state.latitude, state.longitude)
    const map = new maps.Map(mapEl, {
      center,
      zoom: Number(props.scale),
      // scrollwheel: false,
      disableDoubleClickZoom: true,
      mapTypeControl: false,
      zoomControl: false,
      scaleControl: false,
      panControl: false,
      minZoom: 5,
      maxZoom: 18,
      draggable: true,
    })
    watch(
      () => props.scale,
      (scale) => {
        map.setZoom(Number(scale) || 16)
      }
    )
    onBoundsReady(() => {
      if (state.includePoints.length) {
        updateBounds()
        // 首次重设中心点
        updateCenter()
      }
    })
    // 需在 bounds_changed 后触发 BoundsReady
    const boundsChangedEvent = maps.event.addListener(
      map,
      'bounds_changed',
      () => {
        boundsChangedEvent.remove()
        emitBoundsReady()
      }
    )
    maps.event.addListener(map, 'click', () => {
      // TODO 编译器将 tap 转换为 click
      trigger('click', {} as Event, {})
    })
    maps.event.addListener(map, 'dragstart', () => {
      trigger('regionchange', {} as Event, {
        type: 'begin',
        causedBy: 'gesture',
      })
    })
    maps.event.addListener(map, 'dragend', () => {
      trigger(
        'regionchange',
        {} as Event,
        Object.assign(
          {
            type: 'end',
            causedBy: 'drag',
          },
          getMapInfo()
        )
      )
    })
    maps.event.addListener(map, 'zoom_changed', () => {
      emit('update:scale', map.getZoom())
      trigger(
        'regionchange',
        {} as Event,
        Object.assign(
          {
            type: 'end',
            causedBy: 'scale',
          },
          getMapInfo()
        )
      )
    })
    maps.event.addListener(map, 'center_changed', () => {
      const center = map.getCenter()
      const latitude = center.getLat()
      const longitude = center.getLng()
      emit('update:latitude', latitude)
      emit('update:longitude', longitude)
    })
    return map
  }
  try {
    // TODO 支持在页面外使用
    useSubscribe((type, data: any = {}) => {
      switch (type) {
        case 'getCenterLocation':
          onMapReady(() => {
            const center = map.getCenter()
            callback(data, {
              latitude: center.getLat(),
              longitude: center.getLng(),
              errMsg: `${type}:ok`,
            })
          })
          break
        case 'moveToLocation':
          {
            let latitude = Number(data.latitude)
            let longitude = Number(data.longitude)
            if (!latitude || !longitude) {
              const context: MapLocationContext = contexts[
                MAP_LOCATION_CONTEXT_ID
              ] as MapLocationContext
              if (context) {
                latitude = context.state.latitude
                longitude = context.state.longitude
              }
            }
            if (latitude && longitude) {
              state.latitude = latitude
              state.longitude = longitude
              if (map) {
                map.setCenter(new maps.LatLng(latitude, longitude))
              }
              onMapReady(() => {
                callback(data, `${type}:ok`)
              })
            } else {
              callback(data, `${type}:fail`)
            }
          }
          break
        case 'translateMarker':
          onMapReady(() => {
            const context: MapMarkerContext = contexts[
              data.markerId
            ] as MapMarkerContext
            if (context) {
              try {
                context.translate(data)
              } catch (error) {
                callback(data, `${type}:fail ${error.message}`)
              }
              callback(data, `${type}:ok`)
            } else {
              callback(data, `${type}:fail not found`)
            }
          })
          break
        case 'includePoints':
          state.includePoints = getPoints(data.includePoints as Point[])
          if (isBoundsReady) {
            updateBounds()
          }
          onBoundsReady(() => {
            callback(data, `${type}:ok`)
          })
          break
        case 'getRegion':
          onBoundsReady(() => {
            const latLngBounds = map.getBounds()
            const southwest = latLngBounds.getSouthWest()
            const northeast = latLngBounds.getNorthEast()
            callback(data, {
              southwest: {
                latitude: southwest.getLat(),
                longitude: southwest.getLng(),
              },
              northeast: {
                latitude: northeast.getLat(),
                longitude: northeast.getLng(),
              },
              errMsg: `${type}:ok`,
            })
          })
          break
        case 'getScale':
          onMapReady(() => {
            callback(data, {
              scale: map.getZoom(),
              errMsg: `${type}:ok`,
            })
          })
          break
      }
    })
  } catch (error) {}
  onMounted(() => {
    loadMaps((result) => {
      maps = result as QQMapsExt
      map = initMap()
      emitMapReady()
      trigger('updated', {} as Event, {})
    })
  })
  provide('onMapReady', onMapReady)
  provide('addMapChidlContext', addMapChidlContext)
  provide('removeMapChidlContext', removeMapChidlContext)
  return {
    state,
    mapRef,
  }
}

export default /*#__PURE__*/ defineBuiltInComponent({
  name: 'Map',
  props,
  emits: [
    'markertap',
    'labeltap',
    'callouttap',
    'controltap',
    'regionchange',
    'tap',
    'click',
    'updated',
    'update:scale',
    'update:latitude',
    'update:longitude',
  ],
  setup(props, { emit, slots }) {
    const rootRef: Ref<HTMLElement | null> = ref(null)
    const { mapRef } = useMap(props, rootRef, emit as SetupContext['emit'])
    return () => {
      return (
        <uni-map ref={rootRef} id={props.id}>
          <div
            ref={mapRef}
            style="width: 100%; height: 100%; position: relative; overflow: hidden"
          />
          {props.markers.map(
            (item) => item.id && <MapMarker key={item.id} {...item} />
          )}
          {props.polyline.map((item) => (
            <MapPolyline {...item} />
          ))}
          {props.circles.map((item) => (
            <MapCircle {...item} />
          ))}
          {props.controls.map((item) => (
            <MapControl {...item} />
          ))}
          {props.showLocation && <MapLocation />}
          <div style="position: absolute;top: 0;width: 100%;height: 100%;overflow: hidden;pointer-events: none;">
            {slots.default && slots.default()}
          </div>
        </uni-map>
      )
    }
  },
})
