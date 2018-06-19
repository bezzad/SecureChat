var clients = new Map(), // [ { socketid, id, username, email, pubKey, password, avatar, status }]
    messageTypes = ["ack", "request", "message", "symmetricKey"],
    messages = new Map(), // [ { id, date, sender, receiver, type }, ... ]
    rooms = new Map(), // [ { key: roomName, value: { name, p2p, adminUserId, users[] } }, ... ]
    status = ["offline", "online"]; // 0: offline, 1: online

module.exports = {
    clients: clients,
    messageTypes: messageTypes,
    messages: messages,
    rooms: rooms,
    status: status, // 0: offline, 1: online

    // generate 16 char length GUID
    generateGuid: function () {
        return Math.random().toString(36).substring(2, 10) +
            Math.random().toString(36).substring(2, 10);
    },

    getHashCode: String.prototype.hashCode = function () {
        var hash = 0, i, chr;
        if (this.length == 0) return hash;
        for (i = 0; i < this.length; i++) {
            chr = this.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString(32); // to base 32
    },

    getUsers: function () {
        var users = {};
        for ([key, u] of clients) {
            users[key] = {
                id: u.id,
                email: u.email,
                username: u.username,
                avatar: u.avatar,
                status: u.status
            };
        }
        return users;
    },

    getUserRooms: function (userId) {
        var userRooms = {};
        if (userId) {
            for ([key, r] of rooms) {
                var index = r.users.indexOf(userId);
                if (index !== -1 && r.p2p === false) {
                    userRooms[key] = r;
                }
            }
        }
        return userRooms;
    },

    getRoomsName: function () {
        var lstRooms = {};
        for ([key, r] of rooms) {
            if (r.p2p === false) {
                lstRooms[key] = r.roomName;
            }
        }
        return lstRooms;
    },

    findUser: function (socketid) {
        for ([key, value] of clients) {
            if (value.socketid === socketid) {
                return value;
            }
        }
        return null; // user not found
    },

    generateChatRoomName: function (uid0, uid1) {
        var ids = [uid0, uid1].sort();
        return ids[0] + "|" + ids[1]; // unique name for this users private 
    },

    getAdminFromChatName: function (chatName, userid) {

        var admin = null;

        // find room to send client request
        var room = rooms.get(chatName);

        if (room == null) { // requested to new p2p chat
            var halfIndex = chatName.indexOf("|");
            if (halfIndex < 1)
                return null; // p2p chat name incorrect

            var u0 = chatName.substring(0, halfIndex);
            var u1 = chatName.substring(halfIndex + 1);

            admin = (u0 === userid)
                ? clients.get(u1) // u1 is admin id
                : admin = clients.get(u0);  // u0 is admin id
        }
        else
            admin = clients.get(room.adminUserId);

        return admin;
    }
}