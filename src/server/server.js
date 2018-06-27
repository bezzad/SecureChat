// This file is required by app.js. It sets up event listeners
// and listens for socket.io messages.

// Socket.io channels:
//      connection          on new socket created
//      disconnect          on user lost in socket
//      login               on user request to login by user and password
//      signed              on user successfull signed in to application
//      update              on update users and rooms list to all users
//      msg                 on send or receive message in room or private socket
//      exception           on an error occured
//      typing              on a user typing some thing in message text box

// Use the gravatar module, to turn email addresses into avatar images:
var gravatar = require('gravatar');
var manager = require('./manager.js');
var serverVersion = manager.generateGuid(); // a unique version for every startup of server
var connCount = 1;
var globalRoom = "environment"; // add any authenticated user to this room
var chat = {}; // socket.io

// Export a function, so that we can pass 
// the app and io instances from the app.js file:
module.exports = function (app, io) {
    // Initialize a new socket.io application, named 'chat'
    chat = io.on('connection', function (socket) {
        console.info("socket " + connCount++ + "th connected by id: " + socket.id);

        // When the client emits 'login', save his name and avatar,
        // and add them to the room
        socket.on('login', data => {

            var user = manager.clients[data.email.hashCode()];
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
                    "status": "online", // { "online", "offline" }
                    "serverVersion": serverVersion // chance of this version caused to refresh clients cached data
                };
                manager.clients[user.id] = user;
                userSigned(user);
            }
            else if (user.password === data.password) { // exist user, check login password
                userSigned(user);
            }
            else { // exist user, entry password is incorrect
                socket.emit("exception", "The username is already exist, but your password is incorrect!");
                console.info("User " + user.username + " can't login, because that password is incorrect!");
            }

        }); // login

        function userSigned(user) {
            user.status = manager.status[1];
            user.socketid = socket.id;
            //
            // send success ack to user by self data object
            socket.emit("signed", user);

            socket.join(globalRoom); // join all users in global authenticated group
           
            // add user to all joined rooms
            var userRooms = manager.getUserRooms(user.id, true); // by p2p rooms
            for (room in userRooms) {
                socket.join(room);
            }

            console.info("User " + user.username + " connected")
            //
            // tell new user added and list updated to everyone except the socket that starts it
            chat.in(globalRoom).emit("update", { users: manager.getUsers(), rooms: manager.getRoomsName() });

            // Somebody left the chat
            socket.on('disconnect', () => {
                // find user who abandon sockets
                var user = manager.findUser(socket.id);
                if (user !== null) {
                    user.status = manager.status[0]; // offline
                    console.info("User " + user.username + " disconnected!");

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
            socket.on('msg', data => {
                var from = manager.findUser(socket.id);
                var room = manager.rooms[data.to];

                if (from != null && room != null && room.users.indexOf(from.id) != -1) {
                    var msg = manager.messages[room.name];
                    if (msg == null)
                        msg = manager.messages[room.name] = [];

                    data.date = Date.now();
                    data.type = "msg";
                    // When the server receives a message, it sends it to the other person in the room.
                    socket.broadcast.to(room.name).emit('receive', data);
                    msg.push(data);
                }
            });

            // Handle the request of users for chat
            socket.on("request", data => {

                // find user who requested to this chat by socket id
                var from = manager.findUser(socket.id);

                // if user authenticated 
                if (from != null) {

                    // find admin user who should be send request to
                    var adminUser = manager.getAdminFromChatName(data.room, from.id)

                    if (adminUser != null) {
                        if (adminUser.status == manager.status[0]) { // offline admin   
                            var p2p = manager.rooms[data.room] == null ? true : manager.rooms[data.room].p2p;
                            socket.emit("reject", { from: adminUser.id, room: data.room, p2p: p2p, msg: "admin user is offline" });
                        }
                        else
                            chat.to(adminUser.socketid).emit("request", { from: from.id, pubKey: from.pubKey, room: data.room })
                        return;
                    }
                }
                //
                // from or adminUser is null
                socket.emit("exception", "The requested chat room not found!");
            });

            // Handle the request of users for chat
            socket.on("accept", data => {

                // find user who accepted to this chat by socket id
                var from = manager.findUser(socket.id);

                // find user who is target user by user id
                var to = manager.clients[data.to];

                // if users authenticated 
                if (from != null && to != null) {
                    var room = manager.rooms[data.room];
                    if (room == null) { // new p2p room
                        room = { name: data.room, p2p: true, adminUserId: from.id, users: [from.id] };
                        manager.rooms[data.room] = room;
                        socket.to(from.socketid).join(data.room); // add admin to self chat room
                    }
                    //
                    // add new user to this room
                    room.users.push(to.id);
                    socket.to(to.socketid).join(room.name); // add new user to chat room

                    // send accept msg to user which requested to chat
                    socket.to(to.socketid).emit("accept", { from: from.id, room: room.name, p2p: room.p2p, chatKey: data.chatKey })
                }
            });

            // Handle the request of users for chat
            socket.on("reject", data => {

                // find user who accepted to this chat by socket id
                var from = manager.findUser(socket.id);

                // find user who is target user by user id
                var to = manager.clients[data.to];

                // if users authenticated 
                if (from != null && to != null) {
                    var room = manager.rooms[data.room];
                    socket.to(to.socketid).emit("reject", { from: from.id, p2p: (room == null), room: data.room })
                }
            });

            // Handle the request of users for chat
            socket.on("fetch-messages", data => {
                // find fetcher user
                var fetcher = manager.findUser(socket.id);

                var room = manager.rooms[data];

                // check fetcher was a user of room
                if (room != null && room.users.indexOf(fetcher.id) !== -1)
                    socket.emit("fetch-messages", { room: room.name, messages: manager.messages[room.name] });
                else
                    socket.emit("exception", "you are not join on <" + data + "> room or meybe the server lost your data!!!");
            });

        } // signed-in

    }); // connected user - socket scope

} // module.export func