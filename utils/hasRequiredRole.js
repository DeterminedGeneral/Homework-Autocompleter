const ALLOWED_ROLES = Object.values(require('../queue_ranks.json'));

function hasRequiredRole(member) {
    return ALLOWED_ROLES.some(roleId => member.roles.cache.has(roleId));
}

module.exports = hasRequiredRole;