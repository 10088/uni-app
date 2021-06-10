const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

const priority = {
  'uni-shared': 100,
  'uni-app': 90,
  'uni-i18n': 90,
  'uni-mp-vue': 80,
  'uni-mp-alipay': 70,
  'uni-mp-baidu': 70,
  'uni-mp-qq': 70,
  'uni-mp-toutiao': 70,
  'uni-mp-weixin': 70,
  'uni-quickapp-webview': 70,
  'uni-cli-shared': 60,
  'uni-h5': 50,
  'uni-h5-vue': 40,
  'uni-h5-vite': 40,
  'uni-app-plus': 30,
  'uni-app-vite': 30,
  'vite-plugin-uni': 20,
  'size-check': 1,
}

const targets = (exports.targets = fs.readdirSync('packages').filter((f) => {
  if (!fs.statSync(`packages/${f}`).isDirectory()) {
    return false
  }
  try {
    return (
      fs.existsSync(path.resolve(__dirname, `../packages/${f}/build.json`)) ||
      fs.existsSync(path.resolve(__dirname, `../packages/${f}/build.js`))
    )
  } catch (e) {}
  return false
})).sort((a, b) => priority[b] - priority[a])
exports.fuzzyMatchTarget = (partialTargets, includeAllMatching) => {
  const matched = []
  partialTargets.forEach((partialTarget) => {
    for (const target of targets) {
      if (target.match(partialTarget)) {
        matched.push(target)
        if (!includeAllMatching) {
          break
        }
      }
    }
  })
  if (matched.length) {
    return matched.sort((a, b) => priority[b] - priority[a])
  } else {
    console.log()
    console.error(
      `  ${chalk.bgRed.white(' ERROR ')} ${chalk.red(
        `Target ${chalk.underline(partialTargets)} not found!`
      )}`
    )
    console.log()

    process.exit(1)
  }
}
