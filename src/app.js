// This is the main file of our chat app. It initializes a new 
// express.js instance, requires the config and routes files
// and listens on a port. Start the application by running
// 'node app.js' in your terminal

var express = require('express');
var path = require("path");
var app = express();
var port = 80;

// Initialize a new socket.io object. It is bound to 
// the express app, which allows them to coexist.
var io = require('socket.io').listen(app.listen(port));


// ------------------- Config static directories and files ---------------
//
// Set .html as the default template extension
app.set('view engine', 'html');

// Initialize the ejs template engine
app.engine('html', require('ejs').renderFile);

// Tell express where it can find the templates
app.set('views', path.join(__dirname, 'client/views'));

// Make the files in the public folder available to the world
app.use(express.static(path.join(__dirname, 'client')));
// =======================================================================
//


// --------------------------- Router Config -----------------------------
//
// sets up event listeners for the two main URL 
// endpoints of the application - /
app.get('/', function (req, res) {
	// Render views/chat.html
	res.render('chat');
});
// =======================================================================
//

// Require the configuration and the routes files, and pass
// the app and io as arguments to the returned functions.
require('./server/server')(app, io);

console.log('Your application is running on http://localhost:' + port);