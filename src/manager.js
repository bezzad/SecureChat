var clients = new Map(), // [ { socketid, id, username, email, pubKey, password, avatar, status }]
    messageTypes = ["ack", "request", "message", "symmetricKey"],
    messages = new Map(), // [ { id, date, sender, receiver, type }, ... ]
    rooms = new Map(), // [ { roomName, p2p, adminUserId, users[] }, ... ]
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
        if (this.length === 0) return hash;
        for (i = 0; i < this.length; i++) {
            chr = this.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString(32); // to base 32
    },

    getUsers: function () {
        var users = [];
        clients.forEach(u => {
            users.push({
                id: u.id,
                email: u.email,
                username: u.username,
                avatar: u.avatar,
                status: u.status
            })
        });

        return users;
    },

    getUserRooms: function (userId) {
        var userRooms = [];
        if (userId) {
            rooms.forEach(r => {
                var index = r.users.indexOf(userId);
                if (index !== -1 && r.p2p === false) {
                    userRooms.push(r);
                }
            })
        }

        return userRooms;
    },

    getRoomsName: function () {
        var lstRooms = [];
        rooms.forEach(r => {
            if (r.p2p === false) {
                lstRooms.push(r.roomName);
            }
        })
        return lstRooms;
    },

    findUser: function (socketid) {
        for ([key, value] of clients) {
            if (value.socketid === socketid) {
                return value;
            }
        }
        return null; // user not found
    }
}