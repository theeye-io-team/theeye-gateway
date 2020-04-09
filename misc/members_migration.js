
const mongoose = require('mongoose')
const app = require('../server')
const assert = require('assert')

const migrate = async () => {
  // mongo native driver connection
  const db = app.models.datasource.db

  //const passportsCollection = db.collection('web_passport') // authentication passport api users collection
  //const authCollection = db.collection('web_user') // authentication api users collection
  //const customersCollection = db.collection('customers') // supervisor users collection
  //const membersCollection = db.collection('members')
  const usersCollection = db.collection('users') // supervisor users collection

  const main = async () => {
    const members = []

    let users = await usersCollection.find({})
    let userDocs = await users.toArray()

    for (let user of userDocs) {
      let customers = user.customers
      for (let customer of customers) {
        members.push({
          _type: 'Member',
          user: user,
          user_id: user._id,
          customer: mongoose.Types.ObjectId(customer._id),
          customer_id: mongoose.Types.ObjectId(customer._id),
          customer_name: customer.name,
          credential: user.credential,
          creation_date: new Date(),
          last_update: new Date(),
          invitation_token: null,
          enabled: true,
          notifications: (user.credential!=='agent' && user.credential!=='integration') ? {
            mute: false,
            push: true,
            email: true,
            desktop: true
          } : {}
        })
      }
    }

    // agents and intergration tokens wont be affected.
    // must be moved from supervisor api to auth api
    await createBotUsersAuth(members)

    // this will update only human users credentials.
    await memberUserToAuth(members)

    // ready to create members collection
    let documents = await app.models.member.insertMany(members)
    console.log(`Inserted ${documents.length} documents into the collection`)

    await createIntegrationTokenSession()

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
            user: member.user_id,
            user_id: member.user_id,
            customer: member.customer_id,
            customer_id: member.customer_id,
            member: member._id,
            member_id: member._id 
          })
          await session.save()
        }
      }
    }
  }

  /**
   *
   * for each bot user (Agent / Integration) create document in auth api
   *
   */
  const createBotUsersAuth = async (members) => {
    const bots = []

    const createUser = async (member) => {

      let user = member.user

      //create bots in db
      let bot = new app.models.user({
        _type: 'BotUser',
        username: user.client_id,
        //username: user.username || user.email,
        email: user.email || user.username,
        name: user.name || null,
        enabled: true,
        invitation_token: null,
        devices: null,
        notifications: null ,
        onboardingCompleted: true ,
        creation_date: user.creation_date,
        last_update: user.last_update,
        last_login:  null
      })
      await bot.save()

      let passport = new app.models.passport({
        protocol: 'local',
        provider: 'theeye',
        password: user.client_secret,
        identifier: user.client_id,
        tokens: {
          access_token: user.token,
          refresh_token: user.client_secret
        },
        // new bot user created.
        user: bot._id,
        user_id: bot._id,
        creation_date: new Date(),
        last_update: new Date()
      })
      await passport.save()

      // use created user id
      member.user = bot._id
      member.user_id = bot._id
    }

    for (let member of members) {
      if (
        member.credential === 'agent' ||
        member.credential === 'integration'
      ) {
        await createUser(member)
      } else {
        // replace user object with the id
        member.user = member.user._id
      }
    }
  }

  /**
   *
   * convert supervisor user into auth-api credentials
   *
   */
  const memberUserToAuth = async (members) => {
    let users = await app.models.user.find({})

    for (let user of users) {
      // get raw data from database using native driver.
      let passportsIterator = await app.models.passport.collection.find({ user: user._id })
      let passports = await passportsIterator.toArray()

      for (let pass of passports) {
        if (pass.protocol === 'theeye') { // found my passport to theeye. the user id is here
          let supUser = pass.api_user

          for (let mem of members) {
            if (mem.user_id.toString() === supUser) {
              console.log('===============================')
              console.log('member found')
              console.log(mem)
              // found my mem to theeye an update user id to match auth api ids
              // the new id is from auth docs
              mem.user_id = user._id
              mem.user = user._id

              console.log('member updated')
              console.log(mem)
            }
          }
        }
      }
    }
  }

  main ()
}

migrate()
