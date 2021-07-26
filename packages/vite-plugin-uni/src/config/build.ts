import path from 'path'
import { UserConfig } from 'vite'
import { initEasycomsOnce, normalizePath } from '@dcloudio/uni-cli-shared'
import { VitePluginUniResolvedOptions } from '..'

export function createBuild(
  options: VitePluginUniResolvedOptions
): UserConfig['build'] {
  initEasycomsOnce(options.inputDir, options.platform)
  return {
    rollupOptions: {
      output: {
        chunkFileNames(chunkInfo) {
          if (chunkInfo.facadeModuleId) {
            const dirname = path.relative(
              options.inputDir,
              path.dirname(chunkInfo.facadeModuleId)
            )
            if (dirname) {
              return `${options.assetsDir}/${normalizePath(dirname).replace(
                /\//g,
                '-'
              )}-[name].[hash].js`
            }
          }
          return '[name].[hash].js'
        },
      },
    },
  }
}
