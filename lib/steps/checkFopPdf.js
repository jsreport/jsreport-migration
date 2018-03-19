'use strict'

const inquirer = require('inquirer')
const { showSpinner, showSuccess, showWarn } = require('../utils')

module.exports = async (jsreportInstance) => {
  console.log('checking fop-pdf extension usage in project')

  const templatesCollection = jsreportInstance.documentStore.collection('templates')

  const templates = await showSpinner('searching templates in store', async ({ stop, success, fail }) => {
    try {
      const entities = await templatesCollection.find({ recipe: 'fop-pdf' })

      if (entities.length === 0) {
        success('no templates with fop-pdf recipe found to migrate')
        return
      }

      stop()
      return entities
    } catch (e) {
      fail()
      throw e
    }
  })

  if (templates == null || templates.length === 0) {
    return
  }

  console.log([
    `you have ${templates.length} templates(s) stored using fop-pdf recipe. `,
    `jsreport v2 doesn't include fop-pdf as a default recipe but it can be installed separetly.`
  ].join(''))

  const result = await inquirer.prompt([{
    type: 'confirm',
    name: 'fop',
    message: 'should we additionally install fop-pdf to the new v2 instance?',
    default: true
  }])

  if (result.fop) {
    showSuccess('jsreport-fop-pdf will be installed at the end of the migration')
    return true
  }

  showWarn(`${templates.length} templates(s) won't work in your project until you install jsreport-fop-pdf manually`)
}
