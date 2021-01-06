// order matters
const CREDENTIALS = ['viewer','user','agent','manager','integration','admin','owner','root']

class ACL {
  hasFullaccess (credential) {
    return this.accessLevel(credential) >= this.accessLevel('admin')
  }

  accessLevel (credential) {
    return CREDENTIALS.indexOf(credential)
  }

  hasAccessLevel (current, required, options) {
    options||(options={})

    if (options.exactMatch) {
      return this.accessLevel(current) === this.accessLevel(required)
    } else {
      return this.accessLevel(current) >= this.accessLevel(required)
    }
  }
}

module.exports = ACL
