'use strict'

const path = require('path')
const exitHook = require('exit-hook')
const { showInfo, showSuccess, showWarn, showFailure } = require('./utils')
const readyToStart = require('./steps/readyToStart')
const checkInstallation = require('./steps/checkInstallation')
const backupWarning = require('./steps/backupWarning')
const initializeJsreport = require('./steps/initializeJsreport')
const checkImages = require('./steps/checkImages')
const checkScripts = require('./steps/checkScripts')
const checkPhantomPdf = require('./steps/checkPhantomPdf')
const checkFopPdf = require('./steps/checkFopPdf')
const checkConfig = require('./steps/checkConfig')
const checkCronScheduling = require('./steps/checkCronScheduling')
const installNewDeps = require('./steps/installNewDeps')

module.exports = async (customCwd) => {
  const cwd = customCwd != null ? path.resolve(process.cwd(), customCwd) : process.cwd()
  let completed = false
  let hasError = false
  let migrationStarted = false

  if (customCwd != null) {
    process.chdir(cwd)
  }

  console.log('Welcome to migration utility that will help you upgrade from jsreport v1 to v2!\n')

  showInfo('Make sure to check or do the following first before start the migration:\n')

  console.log(' - update your project and check it works with latest jsreport v1 version.')
  console.log(' - backup somewhere your jsreport app and data first before running the migration.')

  console.log('\nFinally, make sure to follow all the steps and answer any question during the migration process.\n')

  showWarn([
    'In case of any error during the process you can contact us and describe the error by ',
    'creating a github issue (https://github.com/jsreport/jsreport-migration/issues) or opening a new topic in our forum (https://forum.jsreport.net/).'
  ].join(''))

  console.log('\n')

  exitHook(() => {
    if (completed || hasError) {
      return
    }

    if (migrationStarted) {
      process.stdout.write('\n')

      showFailure('MIGRATION CANCELED UNEXPECTEDLY! you should restore your project from your backup before running the migration again to ensure the migration can complete correctly in next run.')
    }
  })

  try {
    let response

    response = await readyToStart()

    if (!response.ok) {
      return console.log('\ntake your time and run the CLI again when you are ready.')
    }

    process.stdout.write('\n')

    const jsreportInstance = await checkInstallation(cwd)

    process.stdout.write('\n')

    response = await backupWarning()

    if (!response.ok) {
      return console.log('\ntake your time and ensure that your jsreport app and data are backed up somewhere, then run the CLI again when you are ready.')
    }

    process.stdout.write('\n')

    await initializeJsreport(jsreportInstance)

    process.stdout.write('\n')

    migrationStarted = true

    await checkImages(jsreportInstance)

    process.stdout.write('\n')

    await checkScripts(jsreportInstance)

    process.stdout.write('\n')

    const needsPhantomInstall = await checkPhantomPdf(jsreportInstance)

    process.stdout.write('\n')

    const needsFopInstall = await checkFopPdf(jsreportInstance)

    process.stdout.write('\n')

    await checkConfig(cwd, jsreportInstance, needsPhantomInstall)

    process.stdout.write('\n')

    await checkCronScheduling(jsreportInstance)

    process.stdout.write('\n')

    const packagesToInstall = []

    if (needsPhantomInstall) {
      packagesToInstall.push({
        name: 'jsreport-phantom-pdf',
        pkg: 'jsreport-phantom-pdf@2.x.x'
      })
    }

    if (needsFopInstall) {
      packagesToInstall.push({
        name: 'jsreport-fop-pdf',
        pkg: 'jsreport-fop-pdf@2.x.x'
      })
    }

    if (jsreportInstance.express && jsreportInstance.express.server) {
      jsreportInstance.express.server.close()
    }

    response = await installNewDeps('jsreport@2.x.x', packagesToInstall)

    process.stdout.write('\n')
    process.stdout.write('\n')

    showWarn([
      'All done! just remember that you should not run the migration again in this project or you could have unexpected results. ',
      'If for some reason you want to re-run the migration you should restore your project from your backup and try the migration again from there.'
    ].join(''))

    process.stdout.write('\n')
    process.stdout.write('\n')

    if (!response.ok) {
      showWarn([
        `MIGRATION COMPLETED! but you selected to not install jsreport v2 right now. `,
        `remember to do it before starting your project. you can do it using "npm install ${response.jsreportDep}${
          response.additionalDeps.length > 0 ? ` ${response.additionalDeps.map(d => d.name).join(' ')}` : ''
        } --save" command`
      ].join(''))
    } else {
      showSuccess('MIGRATION COMPLETED! ENJOY')
    }

    completed = true

    process.exit()
  } catch (e) {
    hasError = true

    const errorJSON = JSON.stringify(e)

    process.stdout.write('\n')

    showFailure(`Error found during the migration: ${e.message}${errorJSON !== '{}' ? ` ${errorJSON}` : ''}. stack: ${e.stack}`)

    if (migrationStarted) {
      showFailure('you should restore your project from your backup before running the migration again to ensure the migration can complete correctly in next run.')
    }

    process.exit(1)
  }
}
