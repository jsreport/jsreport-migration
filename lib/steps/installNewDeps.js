'use strict'

const inquirer = require('inquirer')
const { npmInstall, showSpinner } = require('../utils')

module.exports = async (jsreportDep, additionalDeps) => {
  console.log('all ready for the installation step')

  const result = await inquirer.prompt([{
    type: 'confirm',
    name: 'install',
    message: `should we install jsreport v2${additionalDeps.length > 0 ? ` (and ${
      additionalDeps.map(d => d.name).join(', ')
    })` : ''} now?`,
    default: true
  }])

  if (!result.install) {
    return {
      ok: false,
      jsreportDep,
      additionalDeps
    }
  }

  await showSpinner('installing jsreport v2', async ({ text, success, fail }) => {
    const additionalDepsNames = additionalDeps.map(d => d.name)

    try {
      await npmInstall(jsreportDep)

      if (additionalDepsNames.length > 0) {
        text(`installing additional extensions ${additionalDepsNames.join(', ')}`)

        await npmInstall(additionalDeps.map(d => d.pkg))
      }

      success(`jsreport v2${additionalDepsNames.length > 0 ? ` (and ${additionalDepsNames.join(', ')})` : ''} installed successfully`)
    } catch (e) {
      fail()
      throw e
    }
  })

  return {
    ok: true
  }
}
