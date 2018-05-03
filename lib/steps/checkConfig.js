'use strict'

const util = require('util')
const path = require('path')
const fs = require('fs')
const omit = require('lodash.omit')
const inquirer = require('inquirer')
const { showSpinner, showSuccess, showWarn } = require('../utils')

const accessAsync = util.promisify(fs.access)
const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

async function checkFilesExists (cwd, files) {
  const exists = []

  await Promise.all(files.map(async (file) => {
    try {
      await accessAsync(path.join(cwd, file))
      exists.push(file)
    } catch (e) {}
  }))

  return exists
}

module.exports = async (cwd, jsreportInstance, willUsePhantom) => {
  console.log('checking configuration file in project')

  const configFiles = [
    'jsreport.config.json',
    'dev.config.json',
    'prod.config.json'
  ]

  const configFilesToMigrate = await checkFilesExists(cwd, configFiles)

  if (configFilesToMigrate.length === 0) {
    showSuccess('no configuration file found to migrate')
    return
  }

  console.log(`you have ${configFilesToMigrate.length} configuration files(s) in project (${
    configFilesToMigrate.map(f => `"${f}"`).join(', ')
  }).`)

  const result = await inquirer.prompt([{
    type: 'confirm',
    name: 'configuration',
    message: 'should we check the config file(s) and continue with migration?',
    default: true
  }])

  if (!result.configuration) {
    showWarn([
      'user decided to not migrate configuration file(s). ',
      `you will need to check your configuration file(s) (${
        configFilesToMigrate.map(f => `"${f}"`).join(', ')
      }) and update manually, check https://jsreport.net/learn/configuration `,
      'for information about the new configuration format'
    ].join(''))
    return
  }

  await showSpinner('migrating configuration file', async ({ success, fail }) => {
    try {
      await Promise.all(configFilesToMigrate.map(async (file) => {
        const pathToFile = path.join(cwd, file)

        let config = await readFileAsync(pathToFile)

        config = JSON.parse(config)

        config.renderingSource = 'untrusted'

        if (config.connectionString != null) {
          config.store = {
            provider: config.connectionString.name
          }

          delete config.connectionString
        }

        if (config.blobStorage != null) {
          let providerName = config.blobStorage

          if (providerName === 'fileSystem') {
            providerName = 'fs'
          }

          config.blobStorage = {
            provider: providerName
          }
        }

        if (config.tasks != null) {
          config.templatingEngines = config.tasks
          delete config.tasks
        }

        if (config.phantom != null) {
          if (!willUsePhantom) {
            delete config.phantom
          }
        }

        if (config.extensions != null) {
          config.extensionsList = config.extensions
          delete config.extensions
        }

        config.extensions = {}

        if (config.authentication != null) {
          config.extensions.authentication = config.authentication
          delete config.authentication
        }

        if (config.scripts != null) {
          config.extensions.scripts = config.scripts
          delete config.scripts
        }

        if (config['sample-template'] != null) {
          config.extensions['sample-template'] = config['sample-template']
          delete config['sample-template']
        }

        if (config.logger != null) {
          const newLoggerConfig = {}
          const containsTransports = optionsContainsTransports(
            omit(
              config.logger,
              ['silent', 'logDirectory', 'providerName']
            )
          )

          if (config.logger.silent != null) {
            newLoggerConfig.silent = config.logger.silent
          }

          if (containsTransports) {
            Object.assign(newLoggerConfig, omit(
              config.logger,
              ['silent', 'logDirectory', 'providerName']
            ))
          } else {
            const hasLogDirectory = config.logger.logDirectory != null

            if (config.logger.providerName === 'winston') {
              newLoggerConfig.console = {
                transport: 'console',
                level: 'debug'
              }

              newLoggerConfig.file = {
                transport: 'file',
                level: 'debug'
              }

              if (hasLogDirectory) {
                newLoggerConfig.file.filename = path.join(
                  config.logger.logDirectory,
                  'reporter.log'
                )
              }

              newLoggerConfig.error = {
                transport: 'file',
                level: 'debug'
              }

              if (hasLogDirectory) {
                newLoggerConfig.error.filename = path.join(
                  config.logger.logDirectory,
                  'error.log'
                )
              }
            } else if (config.logger.providerName === 'console') {
              newLoggerConfig.console = {
                transport: 'console',
                level: 'debug'
              }
            }
          }

          config.logger = newLoggerConfig
        }

        const extensionsNames = jsreportInstance.extensionsManager.availableExtensions.map(e => e.name)

        extensionsNames.forEach((extName) => {
          if (!willUsePhantom && extName === 'phantom-pdf') {
            return
          }

          if (config[extName] != null) {
            config.extensions[extName] = config[extName]
            delete config[extName]
          }
        })

        await writeFileAsync(pathToFile, JSON.stringify(config, null, 2))
      }))

      success('configuration file migration completed')

      showWarn([
        'After migration is done please remember to compare your previous configuration file with the new generated one to ensure that all values ',
        'in your original file were migrated correctly, check the docs at https://jsreport.net/learn/configuration to verify the new configuration format'
      ].join(''))

      await inquirer.prompt([{
        type: 'input',
        name: 'configMigration',
        message: 'PRESS ENTER TO CONTINUE..',
        filter: (inp) => {
          return ''
        },
        transformer: (inp) => {
          return ''
        }
      }])
    } catch (e) {
      fail()
      throw e
    }
  })
}

function optionsContainsTransports (_options) {
  var options = _options || {}

  return Object.keys(options).some(function (optName) {
    var opt = options[optName]

    return (
      opt &&
      typeof opt === 'object' &&
      !Array.isArray(opt)
    )
  })
}
