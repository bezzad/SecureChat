var e = {}
module.exports = e;

e.clients = {}; // property: id, value: { socketid, id, username, email, pubKey, password, avatar, status }
e.messageTypes = ["ack", "request", "message", "symmetricKey"];
e.messages = {}; // property: channelName, value { from, to, date, type }
e.channels = {}; // property: channelName, value: { name, p2p, adminUserId, users[] }

// generate 16 char length GUID
e.generateGuid = function () {
    return Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10);
}

e.getHashCode = String.prototype.hashCode = function () {
    var hash = 0, i, chr;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(32); // to base 32
}

e.getUsers = function () {
    var users = {};
    for (prop in e.clients) {
        var u = e.clients[prop];
        users[prop] = {
            id: u.id,
            email: u.email,
            username: u.username,
            avatar: u.avatar,
            status: u.status
        };
    }
    return users;
}

e.getUserChannels = function (userId, byP2p = false) {
    var userChannels = {};
    if (userId) {
        for (prop in e.channels) {
            var r = e.channels[prop];
            if (r.users.indexOf(userId) !== -1) {
                if ((byP2p === false && r.p2p === false) || byP2p === true)
                    userChannels[prop] = r;
            }
        }
    }
    return userChannels;
}

e.getChannels = function () {
    var lstChannels = {};
    for (prop in e.channels) {
        var r = e.channels[prop];
        if (r.p2p === false) {
            lstChannels[prop] = r;
        }
    }
    return lstChannels;
}

e.findUser = function (socketid) {
    for (prop in e.clients) {
        var u = e.clients[prop];
        if (u.socketid === socketid) {
            return u;
        }
    }
    return null; // user not found
}

e.generateChannelName = function (uid0, uid1) {
    var ids = [uid0, uid1].sort();
    return ids[0] + "_" + ids[1]; // unique name for this users private 
}

e.getAdminFromChannelName = function (channelName, userid) {
    var admin = null;

    // find channel to send client request
    var channel = e.channels[channelName];

    if (channel == null) { // requested to new p2p channel
        var halfIndex = channelName.indexOf("_");
        if (halfIndex < 1)
            return null; // p2p channel name incorrect

        var u0 = channelName.substring(0, halfIndex);
        var u1 = channelName.substring(halfIndex + 1);

        admin = (u0 === userid)
            ? e.clients[u1] // u1 is admin id
            : admin = e.clients[u0];  // u0 is admin id
    }
    else
        admin = e.clients[channel.adminUserId];

    return admin;
}