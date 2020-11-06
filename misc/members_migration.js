
const mongoose = require('mongoose')
const app = require('../server')

const migrate = async () => {
  // mongo native driver connection
  const db = app.models.datasource.db

  const passportsCollection = db.collection('web_passport') // authentication passport api users collection
  const authCollection = db.collection('web_user') // authentication api users collection
  const usersCollection = db.collection('users') // supervisor users collection

  const main = async () => {
    // migrate all Human users from web_user to gw_user
    let auth = await authCollection.find({})
    let authDocs = await auth.toArray()
    let humans = []
    for (let user of authDocs) {
      let human = new app.models.users.uiUser(user) 
      await human.save()
    }

    // migrate passport to gw_passports
    let humanPassports = []
    let passports = await passportsCollection.find({})
    let passportsDocs = await passports.toArray()
    for (let passport of passportsDocs) {
      if (passport.protocol !== 'theeye') {
        passport.user_id = passport.user
        if (!passport.provider) {
          passport.provider = 'theeye'
        }
        passport.user_id = passport.user
        humanPassports.push(passport)
      } else {
        let user = await app.models.users.uiUser.findById(passport.user)
        let customers = passport.profile.customers

        for (let customer of customers) {
          console.log(`creating member passport ${passport._id.toString()}`)

          let member = new app.models.member({
            user: user,
            user_id: user,
            credential: user.credential,
            notifications: {
              mute: false,
              push: true,
              email: true,
              desktop: true
            },
            customer: mongoose.Types.ObjectId(customer.id),
            customer_id: mongoose.Types.ObjectId(customer.id),
            customer_name: customer.name,
            creation_date: new Date(),
            last_update: new Date()
          })

          await member.save()
        }
      }
    }

    // do not trigger password blowfish hashing. already hashed
    app.models.passport.insertMany(humanPassports)

    // migrate bot/agent/integration
    let users = await usersCollection.find({})
    let userDocs = await users.toArray()
    for (let user of userDocs) {
      if (
        user.credential === 'agent' ||
        user.credential === 'integration'
      ) {
        let botUser = new app.models.users.botUser({
          //_id: user._id, // maintain ids
          username: user.client_id,
          //username: user.username || user.email,
          email: user.email || user.username,
          name: user.name || null,
          enabled: true,
          invitation_token: null,
          devices: null,
          notifications: null,
          onboardingCompleted: true,
          creation_date: user.creation_date,
          last_update: user.last_update,
          credential: user.credential
        })

        await botUser.save()

        // add local authentication
        let localPassport = new app.models.passport({
          protocol: 'local',
          provider: 'theeye',
          password: user.client_secret, // model will encrypt password
          identifier: user.client_id, // username
          tokens: {
            access_token: user.token, // current access token, if any
            refresh_token: user.client_secret // descrypted password. temp fix
          },
          // new bot user created.
          user: botUser._id,
          user_id: botUser._id,
          creation_date: new Date(),
          last_update: new Date()
        })

        // this will trigger password blowfish hashing
        await localPassport.save()

        for (let customer of user.customers) {
          let member = new app.models.member({
            user: botUser._id,
            user_id: botUser._id,
            credential: botUser.credential,
            notifications: {},
            customer: mongoose.Types.ObjectId(customer._id),
            customer_id: mongoose.Types.ObjectId(customer._id),
            customer_name: customer.name,
            creation_date: new Date(),
            last_update: new Date()
          })

          await member.save()
        }
      }
    }

    await createIntegrationTokenSession()

    console.log('migration completed')
    process.exit()
  }

  const createIntegrationTokenSession = async () => {
    let members = await app.models.member.find()
    for (let member of members) {
      if (member.credential === 'integration') {
        let passport = await app.models.passport.findOne({
          user: member.user_id,
          protocol: 'local'
        })

        if (passport) {
          // integration bots tokens never expires.
          let session = new app.models.session({
            token: passport.tokens.access_token,
            expires: null,
            creation_date: new Date(),
            member: member._id,
            member_id: member._id,
            user: member.user_id,
            user_id: member.user_id,
            customer: member.customer_id,
            customer_id: member.customer_id,
            credential: member.credential,
            protocol: 'local'
          })
          await session.save()
        }
      }
    }
  }

  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}

migrate()
