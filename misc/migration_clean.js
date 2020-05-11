

const app = require('../server')

const main = async () => {
  //const db = app.models.datasource.db
  await app.models.users.user.deleteMany({})
  await app.models.passport.deleteMany({})
  await app.models.member.deleteMany({})
  await app.models.session.deleteMany({})
}

app.once('configured', () => {
  main().then(() => {
    process.exit(0)
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
})
