
module.exports = function EscapedRegExp (pattern, options) {
  return new RegExp( `^${escapePattern(pattern)}$`, options )
}

const escapePattern = (string) => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}
