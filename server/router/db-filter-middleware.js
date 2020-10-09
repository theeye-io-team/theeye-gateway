
module.exports = (defaults) => {
  return (req, res, next) => {
    const filters = {}
    const query = req.query

    filters.where = Object.assign({}, (defaults.where||{}), (query.where||{}))
    filters.sort = Object.assign({}, (defaults.sort||{}), (query.sort||{}))
    filters.include = Object.assign({}, (defaults.include||{}), (query.include||{}))
    filters.limit = parseInt(query.limit) || null

    if (query.populate) {
      filters.populate = query.populate
    }

    req.filters = filters
    next()
  }
}
