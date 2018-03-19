'use strict'

const inquirer = require('inquirer')
const { showSpinner, showSuccess, showWarn } = require('../utils')

module.exports = async (jsreportInstance) => {
  console.log('checking scripts extension usage in project')

  const scriptsCollection = jsreportInstance.documentStore.collection('scripts')

  const scriptsToMigrate = await showSpinner('searching scripts in store', async ({ stop, success, fail }) => {
    if (scriptsCollection == null) {
      success('scripts extension not used')
      return
    }

    try {
      const entities = await scriptsCollection.find()

      if (entities.length === 0) {
        success('no scripts found to migrate')
        return
      }

      stop()
      return entities.reduce((acu, script) => {
        const scriptHookRegExp = /.*(?:beforeRender|afterRender)\s*\(([^)]*)\)/g
        const requestRenderRegExp = /.*(?:req\.reporter\.render|request\.reporter\.render)\s*/g
        const match = scriptHookRegExp.exec(script.content)

        if (!match) {
          acu.invalid.push(script)
          return acu
        }

        const argsString = match[1]

        if (argsString == null) {
          acu.badArgs.push(script)
          return acu
        }

        const args = argsString.split(',')

        if (args.length < 2) {
          acu.badArgs.push(script)
          return acu
        }

        if (requestRenderRegExp.test(script.content)) {
          acu.usingRender.push(script)
          return acu
        }

        return acu
      }, { invalid: [], badArgs: [], usingRender: [] })
    } catch (e) {
      fail()
      throw e
    }
  })

  if (
    scriptsToMigrate == null ||
    (
      scriptsToMigrate &&
      scriptsToMigrate.invalid.length === 0 &&
      scriptsToMigrate.badArgs.length === 0 &&
      scriptsToMigrate.usingRender.length === 0
    )
  ) {
    showSuccess('all scripts are ok')
    return
  }

  showWarn([
    'we found some problems in your scripts. ',
    'jsreport v2 has removed support for long time deprecated usage of scripts. ',
    'please check correct usage of scripts here https://jsreport.net/learn/scripts and update your scripts manually resolving the following problems:'
  ].join(''))

  process.stdout.write('\n')

  if (scriptsToMigrate.invalid.length > 0) {
    showWarn(`- scripts with no definition of beforeRender/afterRender functions: ${
      scriptsToMigrate.invalid.map(s => `"${s.name}"`).join(', ')
    }`)
  }

  if (scriptsToMigrate.badArgs.length > 0) {
    showWarn(`- scripts with beforeRender/afterRender functions but with less than 2 arguments: ${
      scriptsToMigrate.badArgs.map(s => `"${s.name}"`).join(', ')
    }`)
  }

  if (scriptsToMigrate.usingRender.length > 0) {
    showWarn(`- scripts with usage of deprecated "reporter.render" method in request object: ${
      scriptsToMigrate.usingRender.map(s => `"${s.name}"`).join(', ')
    }. use proxy.render method from require('jsreport-proxy') instead`)
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'badScriptsConfirmation',
    message: 'PRESS ENTER TO CONTINUE..',
    filter: (inp) => {
      return ''
    },
    transformer: (inp) => {
      return ''
    }
  }])
}
