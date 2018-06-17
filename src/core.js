// This file is required by app.js. It sets up event listeners
// and listens for socket.io messages.

// Socket.io channels:
//      connection          on new socket created
//      disconnect          on user lost in socket
//      login               on user request to login by user and password
//      signedin            on user successfull signed in to application
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
            if (user === undefined) {  // new user
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
                userConnected(user);
            }
            else if (user.password === data.password) { // exist user, check login password
                userConnected(user);
            }
            else { // exist user, entry password is incorrect
                socket.emit("exception", "The username is already exist, but your password is incorrect!");
                console.log("User " + user.username + " can't login, because that password is incorrect!");
            }

            function userConnected(user){
                user.status = "online";
                user.socketid = socket.id;
                socket.emit("signedin", user); // send success ack to user by self data object
                socket.join(globalRoom);
                console.log("User " + user.username + " connected")
                //
                // tell new user added and list updated to everyone except the socket that starts it
                chat.in(globalRoom).emit("update", { users: manager.getUsers(), rooms: manager.getRoomsName() });
            }
            //     chat.in('channelName').clients((error, clients) => {
            //         if (error) throw error;
            //          }


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

            //listen on typing
            socket.on("typing", (data) => {
                socket.broadcast.emit("typing", { username: socket.username });
            })
        });
    });
}