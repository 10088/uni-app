describe('env', () => {
  it('HBuilderX', () => {
    process.env.UNI_HBUILDERX_LANGID = 'fr'
    const i18n = require('../lib/index')
    expect(i18n.getLocale()).toBe('fr')
  })
})
