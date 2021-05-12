import fs from 'fs'
import path from 'path'

import { extend } from '@vue/shared'
import { once, defaultRpx2Unit } from '@dcloudio/uni-shared'

import { parseJson } from './json'

export const parseManifestJson = (inputDir: string) => {
  return parseJson(
    fs.readFileSync(path.join(inputDir, 'manifest.json'), 'utf8')
  )
}

export const parseManifestJsonOnce = once(parseManifestJson)

export const parseRpx2UnitOnce = once((inputDir: string) => {
  const { h5 } = parseManifestJsonOnce(inputDir)
  return extend({}, defaultRpx2Unit, (h5 && h5.rpx) || {})
})

interface CompilerCompatConfig {
  MODE?: 2 | 3
}
function parseCompatConfig(inputDir: string): CompilerCompatConfig {
  return parseManifestJsonOnce(inputDir).compatConfig || {}
}

export const parseCompatConfigOnce = once(parseCompatConfig)
