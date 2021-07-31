declare namespace NodeJS {
  interface Process {
    UNI_NVUE_ENTRY: Record<string, string>
  }
  interface ProcessEnv {
    UNI_PLATFORM: UniApp.PLATFORM
    UNI_INPUT_DIR: string
    UNI_OUTPUT_DIR: string
    UNI_CLI_CONTEXT: string
    UNI_COMPILER_VERSION: string
    UNI_HBUILDERX_PLUGINS: string
    UNI_RENDERER?: 'native'
    UNI_NVUE_COMPILER: 'uni-app' | 'weex' | 'vue'
    UNI_NVUE_STYLE_COMPILER: 'uni-app' | 'weex'
  }
}
