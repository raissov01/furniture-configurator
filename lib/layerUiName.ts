import { DEFAULT_LAYER_ID, type Layer } from '@/src/core/layers'

/** Preserve the saved layer name; only the built-in label gets localised. */
export function layerUiName(layer: Pick<Layer, 'id' | 'name'>, translate: (key: string) => string): string {
  return layer.id === DEFAULT_LAYER_ID && layer.name === 'Әдепкі қабат'
    ? translate('Слой по умолчанию')
    : layer.name
}
