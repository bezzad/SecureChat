// This file is required by app.js. It sets up event listeners
// for the two main URL endpoints of the application - /create and /chat/:id

// Export a function, so that we can pass 
// the app and io instances from the app.js file:
module.exports = function (app, io) {

	app.get('/', function (req, res) {

		// Render views/home.html
		res.render('chat');
	});

	app.get('/chat', function (req, res) {

		// Render the chant.html view
		res.render('chat');
	});
	
};
