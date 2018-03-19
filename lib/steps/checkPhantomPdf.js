'use strict'

const inquirer = require('inquirer')
const { showSpinner, showSuccess, showWarn } = require('../utils')

module.exports = async (jsreportInstance) => {
  console.log('checking phantom-pdf extension usage in project')

  const templatesCollection = jsreportInstance.documentStore.collection('templates')

  const templates = await showSpinner('searching templates in store', async ({ stop, success, fail }) => {
    try {
      const entities = await templatesCollection.find({ recipe: 'phantom-pdf' })

      if (entities.length === 0) {
        success('no templates with phantom-pdf recipe found to migrate')
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
    `you have ${templates.length} templates(s) stored using phantom-pdf recipe. `,
    `jsreport v2 doesn't include phantom-pdf as a default recipe but uses chrome-pdf as the new default instead. `,
    `These two technologies produces different output sizes and we cannot automatically convert templates for you to guarantee the exact same output is produced.`
  ].join(''))

  const result = await inquirer.prompt([{
    type: 'list',
    name: 'phantom',
    message: 'please choose what would you want to do in order to continue',
    choices: [{
      name: 'i will keep using phantom-pdf recipe in jsreport v2 (jsreport-phantom-pdf will be installed additionally to the new v2 instance)',
      short: 'i will keep using phantom-pdf recipe in jsreport v2',
      value: 'keep'
    }, {
      name: 'i want to use chrome-pdf, set my templates to new recipe (you will need to check the output of each of your templates and manually adjust it if needed)',
      short: 'i want to use chrome-pdf, set my templates to new recipe',
      value: 'skip'
    }],
    default: 0
  }])

  if (result.phantom === 'skip') {
    await Promise.all(templates.map((template) => {
      return templatesCollection.update({ _id: template._id }, { $set: { recipe: 'chrome-pdf' } })
    }))

    showSuccess(`${templates.length} template(s) changed from phantom-pdf to chrome-pdf recipe`)
    showWarn(`you will need to verify the output of your templates (${templates.map(t => `"${t.name}"`).join(', ')}) to ensure everything is working correctly`)
    return
  }

  showSuccess(`jsreport-phantom-pdf will be installed at the end of the migration`)

  return true
}
