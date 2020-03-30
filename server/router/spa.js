const express = require('express')
const router = express.Router()
const path = require('path')

const statics = express.static(path.join(__dirname, '../client/dist'))

/* GET home page. */
router.get('/', statics)
router.get('/login', statics)

module.exports = router

