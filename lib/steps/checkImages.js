'use strict'

const util = require('util')
const reduce = require('p-reduce')
const inquirer = require('inquirer')
const { showSpinner, showWarn } = require('../utils')

const asyncReplace = util.promisify(require('async-replace'))

module.exports = async (jsreportInstance) => {
  console.log('checking images extension usage in project')

  const templatesCollection = jsreportInstance.documentStore.collection('templates')
  const imagesCollection = jsreportInstance.documentStore.collection('images')
  const assetsCollection = jsreportInstance.documentStore.collection('assets')

  const images = await showSpinner('searching images in store', async ({ stop, success, warn, fail }) => {
    if (imagesCollection == null) {
      success('images extension not used')
      return
    }

    try {
      const entities = await imagesCollection.find()

      if (entities.length === 0) {
        success('no images found to migrate')
        return
      }

      if (assetsCollection == null) {
        warn([
          `found ${entities.length} image(s) but migration skipped because assets extension is not used. `,
          'you will need to update images to assets manually'
        ].join(''))
        return
      }

      stop()
      return entities
    } catch (e) {
      fail()
      throw e
    }
  })

  if (images == null || images.length === 0) {
    return
  }

  console.log(`you have ${images.length} image(s) stored. jsreport v2 doesn't support images extension and rather encourage to use assets instead.`)

  const result = await inquirer.prompt([{
    type: 'confirm',
    name: 'images',
    message: 'should we migrate stored images to assets and try to update existing templates to use assets?',
    default: true
  }])

  if (!result.images) {
    showWarn('user decided to not continue with migration of images. you will need to update images to assets manually')
    return
  }

  await showSpinner('migrating images to assets', async ({ text, success, fail }) => {
    try {
      const { assets, imageToAssetMap } = await getAssetsFromImages(assetsCollection, images)

      text(' (saving new assets)', true)

      await Promise.all(assets.map((asset) => {
        return assetsCollection.insert({
          name: asset.name,
          content: asset.content
        })
      }))

      text(' (searching assets usage in templates)', true)

      const templates = await templatesCollection.find()
      const templatesUpdated = []

      await Promise.all(templates.map(async (template) => {
        let shouldUpdate = false

        const newContent = await asyncReplace(template.content, /{#image ([^{}]{0,150})}/g, async (str, p1, offset, s, done) => {
          const imageName = (p1.indexOf(' @') !== -1) ? p1.substring(0, p1.indexOf(' @')) : p1
          const imageFound = await imagesCollection.find({ name: imageName })

          // if no image found then image reference was pointing to no existing file
          // we ignore that
          if (imageFound.length === 0) {
            return done(null)
          }

          const encoding = getImageEncoding(p1, imageName)

          // if encoding is empty then we have an invalid image reference so
          // we ignore that
          if (!encoding) {
            return done(null)
          }

          if (!imageToAssetMap[imageName]) {
            return done(null)
          }

          shouldUpdate = true
          done(null, `{#asset ${imageToAssetMap[imageName].name} @encoding=${encoding}}`)
        })

        if (shouldUpdate) {
          await templatesCollection.update({ _id: template._id }, { $set: { content: newContent } })
          templatesUpdated.push(template.name)
        }
      }))

      await Promise.all(images.map((image) => {
        return imagesCollection.remove({ _id: image._id })
      }))

      success(`images to assets migration completed. ${images.length} image(s) migrated, ${templatesUpdated.length} template(s) updated`)
    } catch (e) {
      fail('migrating images to assets')
      throw e
    }
  })
}

function getImageEncoding (str, imageName) {
  let encoding = 'dataURI'

  if (str.indexOf(' @') !== -1) {
    const paramRaw = str.replace(imageName, '').replace(' @', '')

    if (paramRaw.split('=').length !== 2) {
      return
    }

    var paramName = paramRaw.split('=')[0]
    var paramValue = paramRaw.split('=')[1]

    if (paramName !== 'encoding') {
      return
    }

    if (paramValue !== 'base64' && paramValue !== 'dataURI') {
      return
    }

    encoding = paramValue
  }

  return encoding
}

async function verifyImagesInAssets (assetsCollection, images) {
  const newAssetsInfo = await reduce(images, async (acu, image) => {
    const assetName = `${image.name}.${image.contentType.split('/')[1]}`
    const found = await assetsCollection.find({ name: assetName })

    const newAsset = {
      content: image.content
    }

    if (found.length > 0) {
      newAsset.name = image.name
      newAsset.contentType = image.contentType
      acu.conflicts.push(newAsset)
    } else {
      newAsset.name = assetName
      acu.imageToAssetMap[image.name] = newAsset
      acu.good.push(newAsset)
    }

    return acu
  }, { good: [], conflicts: [], imageToAssetMap: {} })

  return newAssetsInfo
}

async function getAssetsFromImages (assetsCollection, images) {
  let allGoodAssets = []
  let allImageToAssetMap = {}
  let newAssetsInfo = await verifyImagesInAssets(assetsCollection, images)

  if (newAssetsInfo.conflicts.length === 0) {
    return {
      assets: newAssetsInfo.good,
      imageToAssetMap: newAssetsInfo.imageToAssetMap
    }
  }

  allGoodAssets = newAssetsInfo.good
  allImageToAssetMap = newAssetsInfo.imageToAssetMap

  while (newAssetsInfo && newAssetsInfo.conflicts.length > 0) {
    newAssetsInfo = await verifyImagesInAssets(
      assetsCollection,
      newAssetsInfo.conflicts.map((assetConflict) => {
        return {
          ...assetConflict,
          name: `image_${assetConflict.name}`
        }
      })
    )

    allGoodAssets = allGoodAssets.concat(newAssetsInfo.good)
    allImageToAssetMap = Object.assign(allImageToAssetMap, newAssetsInfo.imageToAssetMap)
  }

  return {
    assets: allGoodAssets,
    imageToAssetMap: allImageToAssetMap
  }
}
