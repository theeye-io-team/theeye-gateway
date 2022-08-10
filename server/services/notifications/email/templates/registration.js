const template = require('./template')

module.exports = function(data) {
  data.name
  data.subject = 'Welcome to TheEye'
  data.title = 'Confirm your account'
  data.motive = 'Finish the registration process to start using TheEye'
  data.text = `Welcome, ${data.name}!\nEverything is easier with TheEye. Please activate your account to continue.`
  data.hasLink = true
  data.link = data.activation_link
  data.btn_text = 'ACTIVATE'

  return template(data)
}
