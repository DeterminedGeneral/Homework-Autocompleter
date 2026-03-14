const { queue_ranks } = require('../config.json');function whatRole(member) {
    // Find the first role ID from ALLOWED_ROLES that the member has
    const roleId = Object.values(queue_ranks).find(roleId => member.roles.cache.has(roleId));
    return roleId || null; // Return null if no allowed role is found
}

module.exports = whatRole;