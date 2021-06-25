const fs = require('fs')
const path = require('path')
const locales = ['en', 'es', 'fr', 'zh-Hans', 'zh-Hant']

function buildI18n(namespace, dir) {
  const modules = {}
  locales.forEach((locale) => {
    const messages = buildI18nLocale(locale, namespace, dir)
    Object.keys(messages).forEach((moduleName) => {
      ;(modules[moduleName] || (modules[moduleName] = {}))[locale] =
        messages[moduleName]
    })
  })
  // modules
  // {app: {en: { quit: '' },es: { quit: '' },fr: { quit: "" },'zh-Hans': { quit: '' },'zh-Hant': { quit: '' }}}
  const messagesFile = path.resolve(dir, 'messages.ts')
  fs.writeFileSync(messagesFile, generateI18nCode(namespace, modules))
  console.log('write:' + messagesFile)
}

function buildI18nLocale(locale, namespace, dir) {
  return buildI18nModuleMessages(
    require(path.resolve(dir, locale + '.json')),
    namespace
  )
}

function buildI18nModuleMessages(messages, namespace) {
  const modules = {}
  Object.keys(messages).forEach((name) => {
    const [module, ...part] = name.replace(namespace + '.', '').split('.')
    ;(modules[module] || (modules[module] = {}))[part.join('.')] =
      messages[name]
  })
  return modules
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
function generateI18nCode(namespace, modules) {
  return (
    `
// This file is created by scripts/i18n.js
// Do not modify this file!!!!!!!!!
import { once } from '@dcloudio/uni-shared'
import {
    LOCALE_EN,
    LOCALE_ES,
    LOCALE_FR,
    LOCALE_ZH_HANS,
    LOCALE_ZH_HANT,
  } from '@dcloudio/uni-i18n'
  import { useI18n } from './useI18n'

  function normalizeMessages(
    namespace: string,
    messages: Record<string, string>
  ) {
    return Object.keys(messages).reduce<Record<string, string>>((res, name) => {
      res[namespace + name] = messages[name]
      return res
    }, {})
  }
` +
    Object.keys(modules)
      .map((name) => generateI18nModuleCode(namespace, name, modules[name]))
      .join('')
  )
}

function generateI18nModuleCode(namespace, name, localeMessages) {
  return `export const initI18n${capitalize(
    name
  )}MsgsOnce = /*#__PURE__*/ once(()=> {
  const name = '${namespace}.${name}.'      
${Object.keys(localeMessages)
  .map((locale) => generateI18nModuleLocaleCode(locale, localeMessages[locale]))
  .join('')}
})
`
}

function generateI18nModuleLocaleCode(locale, messages) {
  locale = locale.toUpperCase().replace('-', '_')
  return `  if (__UNI_FEATURE_I18N_${locale}__) {
    useI18n().add(LOCALE_${locale}, normalizeMessages(name, ${JSON.stringify(
    messages
  )}))
  }
`
}

buildI18n('uni', path.resolve(__dirname, '../packages/uni-core/src/i18n'))
