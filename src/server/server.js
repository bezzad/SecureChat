// This file is required by app.js. It sets up event listeners
// and listens for socket.io messages.

// Socket.io channels:
//      connection          on new socket created
//      disconnect          on user lost in socket
//      login               on user request to login by user and password
//      signed              on user successfull signed in to application
//      update              on update users and rooms list to all users
//      msg                 on send or receive message in room or private socket
//      error               on an error occured
//      typing              on a user typing some thing in message text box

// Use the gravatar module, to turn email addresses into avatar images:
var gravatar = require('gravatar');
var manager = require('./manager.js');
var connCount = 1;
var globalRoom = "environment"; // add any authenticated user to this room

// Export a function, so that we can pass 
// the app and io instances from the app.js file:
module.exports = function (app, io) {
    // Initialize a new socket.io application, named 'chat'
    var chat = io.on('connection', function (socket) {

        console.log("socket " + connCount++ + "th connected by id: " + socket.id);

        // When the client emits 'login', save his name and avatar,
        // and add them to the room
        socket.on('login', function (data) {

            var user = manager.clients.get(data.email.hashCode());
            if (user == null) {  // new user
                // Use the socket object to store data. Each client gets
                // their own unique socket object
                var user = {
                    "socketid": socket.id, // just solid for this connection and changed for another connecting times
                    "id": data.email.hashCode(), // unique for this email
                    "username": data.username, // display name, maybe not unique
                    "email": data.email, // unique email address for any users
                    "pubKey": data.pubKey, // public key of this client asymmetric cipher's                    
                    "password": data.password, // Store Password Hashing for client login to authenticate one user per email
                    "avatar": gravatar.url(data.email, { s: '140', r: 'x', d: 'mm' }), // user avatar picture's
                    "status": "online" // { "online", "offline" }
                };
                manager.clients.set(data.email.hashCode(), user);
                userSigned(user);
            }
            else if (user.password === data.password) { // exist user, check login password
                userSigned(user);
            }
            else { // exist user, entry password is incorrect
                socket.emit("exception", "The username is already exist, but your password is incorrect!");
                console.log("User " + user.username + " can't login, because that password is incorrect!");
            }

        }); // login

        function userSigned(user) {
            user.status = manager.status[1];
            user.socketid = socket.id;
            //
            // send success ack to user by self data object
            socket.emit("signed", user);

            socket.join(globalRoom);
            console.log("User " + user.username + " connected")
            //
            // tell new user added and list updated to everyone except the socket that starts it
            chat.in(globalRoom).emit("update", { users: manager.getUsers(), rooms: manager.getRoomsName() });

            // Somebody left the chat
            socket.on('disconnect', function () {
                // find user who abandon sockets
                var user = manager.findUser(socket.id);
                if (user !== null) {
                    user.status = manager.status[0]; // offline
                    console.log("User " + user.username + " disconnected!");

                    // Notify the other person in the chat room
                    // that his partner has left
                    socket.broadcast.to(globalRoom).emit('leave',
                        { username: user.username, id: user.id, avatar: user.avatar, status: user.status });

                    // leave the joined rooms
                    socket.leave(globalRoom);
                    socket.leave(socket.rooms);
                }
            });

            // Handle the sending of messages
            socket.on('msg', (data) => {
                // When the server receives a message, it sends it to the other person in the room.
                socket.broadcast.to(socket.room).emit('receive', { msg: data.msg, user: data.user, img: data.img });
            });

            // listen on typing
            socket.on("typing", (data) => {
                socket.broadcast.emit("typing", { username: socket.username });
            })

            // Handle the request of users for chat
            socket.on("request", (data) => {

                // find user who requested to this chat by socket id
                var from = manager.findUser(socket.id);

                // if user authenticated 
                if (from != null) {

                    // find admin user who should be send request to
                    var adminUser = manager.getAdminFromChatName(data.room, from.id)

                    if (adminUser != null) {
                        socket.to(adminUser.socketid).emit("request", { from: from.id, pubKey: from.pubKey, room: data.room })
                        return;
                    }
                }
                //
                // from or adminUser is null
                socket.emit("exception", "The requested chat room not found!");
            });

            // Handle the request of users for chat
            socket.on("accept", (data) => {

                // find user who accepted to this chat by socket id
                var from = manager.findUser(socket.id);

                // find user who is target user by user id
                var to = manager.clients.get(data.to);

                // if users authenticated 
                if (from != null && to != null) {
                    var room = manager.rooms.get(data.room);
                    if (room == null) { // new p2p room
                        room = { name: data.room, p2p: true, adminUserId: from.id, users: [] };
                        manager.rooms.set(data.room, room);
                        socket.sockets.to(from.socketid).join(data.room); // add admin to self chat room
                    }
                    //
                    // add new user to this room
                    room.users.push(to.id);
                    socket.sockets.to(to.socketid).join(room.name); // add new user to chat room

                    // send accept msg to user which requested to chat
                    socket.to(to.socketid).emit("accept", { from: from.id, room: room.name, semmetric: data.semmetric })
                }
            });

            // Handle the request of users for chat
            socket.on("reject", (data) => {

                // find user who accepted to this chat by socket id
                var from = manager.findUser(socket.id);

                // find user who is target user by user id
                var to = manager.clients.get(data.to);

                // if users authenticated 
                if (from != null && to != null) {
                    var room = manager.rooms.get(data.room);
                    socket.to(to.socketid).emit("reject", { from: from.id, p2p: (room == null), room: data.room })
                }
            });
        } // signed-in

    }); // connected user - socket scope

} // module.export func