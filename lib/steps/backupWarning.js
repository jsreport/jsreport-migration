'use strict'

const inquirer = require('inquirer')
const { showSuccess } = require('../utils')

module.exports = async (cwd) => {
  console.log([
    'please be sure to backup your jsreport app and data before continuing. ',
    'remember that you can backup your data by using the export feature (https://jsreport.net/learn/import-export) ',
    'of jsreport, and to backup your app you can make a copy of your project files and save it somewhere'
  ].join(''))

  const result = await inquirer.prompt([{
    type: 'confirm',
    name: 'backup',
    message: 'should we continue?',
    default: false
  }])

  if (result.backup) {
    showSuccess('user confirmed that project backup is done')
  }

  return {
    ok: result.backup
  }
}
