var e = {}
module.exports = e;

e.clients = {}; // property: id, value: { socketid, id, username, email, pubKey, password, avatar, status }
e.messageTypes = ["ack", "request", "message", "symmetricKey"];
e.messages = {}; // property: roomName, value { from, to, date, type }
e.rooms = {}; // property: roomName, value: { name, p2p, adminUserId, users[] },
e.status = ["offline", "online"]; // 0: offline, 1: online

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

e.getUserRooms = function (userId, byP2p = false) {
    var userRooms = {};
    if (userId) {
        for (prop in e.rooms) {
            var r = e.rooms[prop];
            if (r.users.indexOf(userId) !== -1) {
                if ((byP2p === false && r.p2p === false) || byP2p === true)
                    userRooms[prop] = r;
            }
        }
    }
    return userRooms;
}

e.getRoomsName = function () {
    var lstRooms = {};
    for (prop in e.rooms) {
        var r = e.rooms[prop];
        if (r.p2p === false) {
            lstRooms[prop] = r.roomName;
        }
    }
    return lstRooms;
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

e.generateChatRoomName = function (uid0, uid1) {
    var ids = [uid0, uid1].sort();
    return ids[0] + "_" + ids[1]; // unique name for this users private 
}

e.getAdminFromChatName = function (chatName, userid) {

    var admin = null;

    // find room to send client request
    var room = e.rooms[chatName];

    if (room == null) { // requested to new p2p chat
        var halfIndex = chatName.indexOf("_");
        if (halfIndex < 1)
            return null; // p2p chat name incorrect

        var u0 = chatName.substring(0, halfIndex);
        var u1 = chatName.substring(halfIndex + 1);

        admin = (u0 === userid)
            ? e.clients[u1] // u1 is admin id
            : admin = e.clients[u0];  // u0 is admin id
    }
    else
        admin = e.clients[room.adminUserId];

    return admin;
}