'use strict'

const inquirer = require('inquirer')

module.exports = async () => {
  const result = await inquirer.prompt([{
    type: 'confirm',
    name: 'start',
    message: 'ready to start?',
    default: false
  }])

  return {
    ok: result.start
  }
}
