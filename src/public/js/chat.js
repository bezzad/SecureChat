// This file is executed in the browser, when people visit /chat

$(function () {
	// connect to the socket
	var socket = io();

	// variables which hold the data for each person
	var me = null,
		lstUsers = null,
		lstRooms = null,
		fadeInterval = 800,
		status = ["offline", "online"]; // 0: offline, 1: online

	// on connection to server get the id of person's room
	socket.on("connect", () => {
		showMessage("connected");
		setConnectionStatus("connected");
		$(".loginForm").on('submit', function (e) {

			e.preventDefault();

			var name = $.trim($("#yourName").val());
			if (name.length < 1) {
				alert("Please enter a nick name longer than 1 character!");
				return;
			}

			var email = $("#yourEmail").val();
			if (!isValid(email)) {
				alert("Wrong e-mail format!");
				return;
			}

			var pass = $("#yourPass").val();
			if (pass.length < 2) {
				alert("Please enter your passwrod longer than 2 character!");
				return;
			}

			socket.emit('login', { username: name, email: email, password: pass, pubKey: "testPubKey" });
		});
	});

	socket.on("disconnect", () => {
		setConnectionStatus("connecting");
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
		$("#usersmenu").empty();
		$("#roomsmenu").empty();

		lstUsers.forEach(user => {
			$("#usersmenu").append("<li id='userid_" + user.id + "'>" + getUserLink(user) + "</li>")
		});
		$("#usersmenu").collapse('show');

		lstRooms.forEach(room => {
			$("#roomsmenu").append("<li id='roomname_" + room.roomName + "'>" + room.roomName + "</li>")
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


	








	socket.on('startChat', function (data) {
		console.log(data);
		if (data.boolean && data.id == id) {

			$(".chats").empty();

			if (me.username === data.users[0]) {

				showMessage("youStartedChatWithNoMessages", data);
			}
			else {

				showMessage("heStartedChatWithNoMessages", data);
			}

			$(".nickname-chat").text(friend);
		}
	});


	socket.on('receive', function (data) {

		showMessage('chatStarted');

		if (data.msg.trim().length) {
			createChatMessage(data.msg, data.user, data.img, moment());
			scrollToBottom();
		}
	});

	$("#chatform").on('submit', function (e) {

		e.preventDefault();

		// Create a new chat message and display it directly
		showMessage("chatStarted");

		if ($("#message").val().trim().length) {
			createChatMessage($("#message").val(), me.username, img, moment());
			scrollToBottom();

			// Send the message to the other person in the chat
			socket.emit('msg', { msg: $("#message").val(), user: me.username, img: me.avatar });

		}
		// Empty the textarea
		$("#message").val("");
	});


	$("#message").keypress(function (e) {
		// Submit the form on enter
		if (e.which == 13) {
			e.preventDefault();
			$("#chatform").trigger('submit');
		}
	});











	// Update the relative time stamps on the chat messages every minute
	setInterval(function () {

		$(".timesent").each(function () {
			var each = moment($(this).data('time'));
			$(this).text(each.fromNow());
		});

	}, 60000);

	function setConnectionStatus(state) {
		if (state === "connected") {
			$("#connected").fadeIn();
			$("#disconnected").css("display", "none");
			$("#connecting").css("display", "none");
		}
		else if (state === "disconnected") {
			$("#connected").css("display", "none");
			$("#disconnected").fadeIn();
			$("#connecting").css("display", "none");
		}
		else if (state === "connecting") {
			$("#connected").css("display", "none");
			$("#disconnected").css("display", "none");
			$("#connecting").fadeIn();
		}
	}

	// Function that creates a new chat message
	function createChatMessage(msg, user, imgg, now) {
		var who = '';

		if (user === me.username) {
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

		$(".chats").append(li);

		$(".timesent").last().text(now.fromNow());
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

			$(".section").children().css('display', 'none');
			$(".connected").fadeIn(fadeInterval);
		}

		else if (status === "signedin") {
			$(".connected").css("display", "none");
			$(".selectChatMessage").fadeIn(fadeInterval);
		}

		else if (status === "youStartedChatWithNoMessages") {

			$(".left").fadeOut(fadeInterval, function () {
				$(".invite-textfield").fadeOut(fadeInterval, function () {
					$(".nomessages").fadeIn(fadeInterval);
					$("footer").fadeIn(fadeInterval);
				});
			});

			friend = data.users[1];
			$("#noMessagesImage").attr("src", data.avatars[1]);
		}

		else if (status === "heStartedChatWithNoMessages") {

			personInside.fadeOut(fadeInterval, function () {
				$(".nomessages").fadeIn(fadeInterval);
				$("footer").fadeIn(fadeInterval);
			});

			friend = data.users[0];
			$("#noMessagesImage").attr("src", data.avatars[0]);
		}

		else if (status === "chatStarted") {

			$(".section").children().css('display', 'none');
			$(".chatscreen").css('display', 'block');
		}

		else if (status === "somebodyLeft") {

			$("#leftImage").attr("src", data.avatar);
			$(".nickname-left").text(data.user);

			$(".section").children().css('display', 'none');
			$("footer").css('display', 'none');
			$(".left").fadeIn(fadeInterval);
		}
	}

});
