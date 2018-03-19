'use strict'

const inquirer = require('inquirer')
const { showSuccess, showWarn } = require('../utils')

module.exports = async (originalConfig) => {
  console.log('checking logging configuration in project')

  const invalidConfigs = []

  if (originalConfig.logger && originalConfig.logger.providerName != null) {
    invalidConfigs.push('logger.providerName')
  }

  if (originalConfig.logger && originalConfig.logger.logDirectory != null) {
    invalidConfigs.push('logger.logDirectory')
  }

  if (invalidConfigs.length === 0) {
    showSuccess('logging configuration is ok')
    return
  }

  showWarn([
    `you are using some logging option(s) that are not supported in v2: ${
      invalidConfigs.map(m => `"${m}"`).join(', ')
    }. `,
    'you will need to update your logging configuration manually, ',
    'check https://jsreport.net/learn/configuration#logging-configuration ',
    'for details about the new logging configuration format.'
  ].join(''))

  await inquirer.prompt([{
    type: 'input',
    name: 'badLoggingConfigConfirmation',
    message: 'PRESS ENTER TO CONTINUE..',
    filter: (inp) => {
      return ''
    },
    transformer: (inp) => {
      return ''
    }
  }])
}
