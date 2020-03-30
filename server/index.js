const express = require('express')
const path = require('path')
//const cookieParser = require('cookie-parser')

const app = express()
const port = 3000

app.use(express.static(path.join(__dirname, '../client/dist')))

const router = require('./router')(app)

//app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.listen(port, () => console.log(`api ready`))
