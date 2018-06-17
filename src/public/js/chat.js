// This file is executed in the browser, when people visit /chat/<random id>

$(function () {

	// connect to the socket
	var socket = io();

	// variables which hold the data for each person
	var name = "",
		email = "",
		pass = "",
		me = NaN,
		lstUsers = NaN,
		lstRooms = NaN,
		fadeInterval = 800,
		status = ["offline", "online"]; // 0: offline, 1: online

	// cache some jQuery objects
	var section = $(".section"),
		footer = $("footer"),
		onConnect = $(".connected"),
		inviteSomebody = $(".invite-textfield"),
		chatScreen = $(".chatscreen"),
		left = $(".left"),
		noMessages = $(".nomessages"),
		selectChatMessage = $(".selectChatMessage");

	// some more jquery objects
	var chatNickname = $(".nickname-chat"),
		leftNickname = $(".nickname-left"),
		loginForm = $(".loginForm"),
		yourName = $("#yourName"),
		yourEmail = $("#yourEmail"),
		yourPass = $("#yourPass"),
		hisName = $("#hisName"),
		hisEmail = $("#hisEmail"),
		chatForm = $("#chatform"),
		textarea = $("#message"),
		messageTimeSent = $(".timesent"),
		chats = $(".chats"),
		users = $("#usersmenu"),
		rooms = $("#roomsmenu");


	// these variables hold images
	var ownerImage = $("#ownerImage"),
		leftImage = $("#leftImage"),
		noMessagesImage = $("#noMessagesImage");


	// on connection to server get the id of person's room
	socket.on('connect', function () {
		showMessage("connected");

		loginForm.on('submit', function (e) {

			e.preventDefault();

			name = $.trim(yourName.val());
			if (name.length < 1) {
				alert("Please enter a nick name longer than 1 character!");
				return;
			}

			email = yourEmail.val();
			if (!isValid(email)) {
				alert("Wrong e-mail format!");
				return;
			}

			pass = yourPass.val();
			if (pass.length < 2) {
				alert("Please enter your passwrod longer than 2 character!");
				return;
			}

			socket.emit('login', { username: name, email: email, password: pass, pubKey: "testPubKey" });
		});
	});

	socket.on("exception", (err) => {
		alert(err);
	});

	// save the my user data
	socket.on('signedin', (data) => {
		me = data;
		$("#myAvatar").attr("src", me.avatar);
		$("#myUsername").html(me.username);
		showMessage("signedin", data);
	});

	// update users and rooms data
	socket.on('update', (data) => {
		lstUsers = data.users.filter(function (u) { return u.id !== me.id; });
		lstRooms = data.rooms;
		users.empty();
		rooms.empty();

		lstUsers.forEach(user => {
			users.append("<li id='userid_" + user.id + "'>" + getUserLink(user) + "</li>")
		});
		$("#usersmenu").collapse('show');

		lstRooms.forEach(room => {
			rooms.append("<li id='roomname_" + room.roomName + "'>" + room.roomName + "</li>")
		});
		$("#roomsmenu").collapse('show');

	});

	function getUserLink(user) {
		return "<a href='#'><img src='" + user.avatar + "' height='32' width='32' style='border-radius: 50%;'>&nbsp;" +
			"<img src='img//" + user.status + "_status.png' height='16' width='16'>" + user.username + "</a>";
	}

	// when a client socket disconnected
	socket.on('leave', function (leftedUser) {
		lstUsers.forEach(u => {
			if (u.id === leftedUser.id) {
				u.status = status[0]; // offline
				$("#userid_" + u.id).html(getUserLink(u))
			}
		});
	});


	// Other useful 

	socket.on('startChat', function (data) {
		console.log(data);
		if (data.boolean && data.id == id) {

			chats.empty();

			if (name === data.users[0]) {

				showMessage("youStartedChatWithNoMessages", data);
			}
			else {

				showMessage("heStartedChatWithNoMessages", data);
			}

			chatNickname.text(friend);
		}
	});


	socket.on('receive', function (data) {

		showMessage('chatStarted');

		if (data.msg.trim().length) {
			createChatMessage(data.msg, data.user, data.img, moment());
			scrollToBottom();
		}
	});

	chatForm.on('submit', function (e) {

		e.preventDefault();

		// Create a new chat message and display it directly
		showMessage("chatStarted");

		if (textarea.val().trim().length) {
			createChatMessage(textarea.val(), name, img, moment());
			scrollToBottom();

			// Send the message to the other person in the chat
			socket.emit('msg', { msg: textarea.val(), user: name, img: img });

		}
		// Empty the textarea
		textarea.val("");
	});


	textarea.keypress(function (e) {
		// Submit the form on enter
		if (e.which == 13) {
			e.preventDefault();
			chatForm.trigger('submit');
		}
	});

	// Update the relative time stamps on the chat messages every minute
	setInterval(function () {

		messageTimeSent.each(function () {
			var each = moment($(this).data('time'));
			$(this).text(each.fromNow());
		});

	}, 60000);

	// Function that creates a new chat message
	function createChatMessage(msg, user, imgg, now) {

		var who = '';

		if (user === name) {
			who = 'me';
		}
		else {
			who = 'you';
		}

		var li = $(
			'<li class=' + who + '>' +
			'<div class="image">' +
			'<img src=' + imgg + ' />' +
			'<b></b>' +
			'<i class="timesent" data-time=' + now + '></i> ' +
			'</div>' +
			'<p></p>' +
			'</li>');

		// use the 'text' method to escape malicious user input
		li.find('p').text(msg);
		li.find('b').text(user);

		chats.append(li);

		messageTimeSent = $(".timesent");
		messageTimeSent.last().text(now.fromNow());
	}

	function scrollToBottom() {
		$("html, body").animate({ scrollTop: $(document).height() - $(window).height() }, 1000);
	}

	function isValid(thatemail) {

		var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return re.test(thatemail);
	}

	function showMessage(status, data) {

		if (status === "connected") {

			section.children().css('display', 'none');
			onConnect.fadeIn(fadeInterval);
		}

		else if (status === "signedin") {
			onConnect.css("display", "none");
			selectChatMessage.fadeIn(fadeInterval);
		}

		else if (status === "youStartedChatWithNoMessages") {

			left.fadeOut(fadeInterval, function () {
				inviteSomebody.fadeOut(fadeInterval, function () {
					noMessages.fadeIn(fadeInterval);
					footer.fadeIn(fadeInterval);
				});
			});

			friend = data.users[1];
			noMessagesImage.attr("src", data.avatars[1]);
		}

		else if (status === "heStartedChatWithNoMessages") {

			personInside.fadeOut(fadeInterval, function () {
				noMessages.fadeIn(fadeInterval);
				footer.fadeIn(fadeInterval);
			});

			friend = data.users[0];
			noMessagesImage.attr("src", data.avatars[0]);
		}

		else if (status === "chatStarted") {

			section.children().css('display', 'none');
			chatScreen.css('display', 'block');
		}

		else if (status === "somebodyLeft") {

			leftImage.attr("src", data.avatar);
			leftNickname.text(data.user);

			section.children().css('display', 'none');
			footer.css('display', 'none');
			left.fadeIn(fadeInterval);
		}
	}

});
