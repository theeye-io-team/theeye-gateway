/**
 *
 * @return {Promise}
 *
 */
const logger = require('../logger')('router:api-fetch')
module.exports = function (filter, next) {
	const query = this.find(filter.where)

	if (filter.include) { query.select(filter.include) }
	if (filter.sort) { query.sort(filter.sort) }
	if (filter.limit) { query.limit(filter.limit) }
	if (filter.skip) { query.skip(filter.skip) }
	if (filter.populate) {
		if (Array.isArray(filter.populate)) {
			query.populate(filter.populate.join(','))
		} else {
			query.populate(filter.populate)
		}
	}

	logger.data('%s query %j', this.modelName, filter)

	return query.exec()
}
