// This file is executed in the browser, when people visit /chat

// variables which hold the data for each person
var socket = io(), // connect to the socket
	me = null, // keep my info, username, avatar, ...
	lstUsers = null,
	lstRooms = null,
	currentChatName = "",
	state = ["offline", "online"], // 0: offline, 1: online
	sh512Hasing = forge.md.sha512.create(),
	myRoomData = localStorage.myRooms == null
		? {}
		: JSON.parse(localStorage.myRooms);

// on connection to server get the id of person's room
socket.on("connect", () => {
	setConnectionStatus("connected");

	if (localStorage.me == null) {
		showMessage("connected");
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

			sh512Hasing.update(pass); // hasing password in sha-512
			socket.emit('login', { username: name, email: email, password: sh512Hasing.digest().toHex(), pubKey: "testPubKey" });
		});
	}
	else {
		me = JSON.parse(localStorage.me);
		socket.emit('login', me);
	}
});


socket.on("disconnect", () => {
	setConnectionStatus("connecting");
});


socket.on("exception", (err) => {
	alert(err);
});


// save the my user data
socket.on('signed', (data) => {
	me = data;
	localStorage.me = JSON.stringify(me);
	$("#myAvatar").attr("src", me.avatar);
	$("#myUsername").html(me.username);
	showMessage("signedin", me);
});


// update users and rooms data
socket.on('update', (data) => {
	lstUsers = data.users; //.filter(function (u) { return u.id !== me.id; });
	lstRooms = data.rooms;
	$("#usersmenu").empty();
	$("#roomsmenu").empty();

	delete lstUsers[me.id]; // remove me from users list
	for (prop in lstUsers) {
		var user = lstUsers[prop];
		$("#usersmenu").append("<li id='userid_" + user.id + "'>" + getUserLink(user) + "</li>");
	}
	$("#usersmenu").collapse('show');

	for (prop in lstRooms) {
		var room = lstRooms[prop];
		$("#roomsmenu").append("<li id='roomname_" + room.roomName + "'>" + room.roomName + "</li>")
	};
	$("#roomsmenu").collapse('show');

});


// when a client socket disconnected
socket.on('leave', (leftedUser) => {
	var u = lstUsers[leftedUser.id];
	if (u != null) {
		u.status = leftedUser.status;
		$("#userid_" + u.id).html(getUserLink(u))
	}
});


// on a user join request to the chat's which me is admin of 
socket.on('request', (data) => {
	var reqUser = lstUsers[data.from];
	if (reqUser == null) return; // incorrect request from

	var reqRoom = myRoomData[data.room];

	if (reqRoom == null || reqRoom.p2p == false) {
		var q = (reqRoom == null) // is new p2p room?
			? "Do you allow <" + reqUser.username + "> to chat with you?"
			: "Do you allow <" + reqUser.username + "> to join in <" + reqRoom.roomName + "> room?"

		// ask me to accept or reject user request
		if (confirm(q) == false) {
			socket.emit("reject", { to: data.from, room: data.room });
			return;
		}
	}

	if (reqRoom == null) {
		// Now, my socket is admin for requested room
		// generate symmetric key 
		var symmetricKey = "symmetricKeyForThisRoom";
		//
		// store this room to my rooms list
		addMyRoom(data.room, { room: data.room, p2p: true, chatKey: symmetricKey });
	}
	// and encrypt that by requester public key
	var encSymmetricKey = myRoomData[data.room] + data.pubKey + "EncryptedByAnotherUserPubKey";
	//
	// send data to requester user to join in current room
	socket.emit("accept", { to: data.from, chatKey: encSymmetricKey, room: data.room })
	showMessage("chatStarted", data);
});


socket.on('accept', (data) => {
	console.log("room [" + data.room + "] is now open.");
	var admin = lstUsers[data.from];
	var symmetricKey = data.chatKey + "decryptByMyPrivateKey";
	//
	// store this room to my rooms list
	addMyRoom(data.room, { room: data.room, p2p: data.p2p, chatKey: symmetricKey });
	showMessage("chatStarted", data);
	document.getElementById(data.room).style.display = "none"; // jquery exception in "|"
});


socket.on('reject', (data) => {
	var admin = lstUsers[data.from];
	var reason = data.msg == null ? "" : data.msg;
	if (data.p2p)
		alert("The user <" + admin.username + "> rejected your chat request. " + reason);
	else
		alert("The user <" + admin.username + "> as admin of <" + data.room + ">, rejected your chat request. " + reason);

	document.getElementById(data.room).style.display = "none"; // jquery exception in "|"
});


socket.on('receive', function (data) {
	if (currentChatName = data.to) {
		// Create a new chat message and display it directly
		showMessage('chatStarted');
	}

	if (data.msg.trim().length) {
		createChatMessage(data.msg, data.from, data.img, moment());
		scrollToBottom();
	}
});


$("#chatform").on('submit', function (e) {

	e.preventDefault();

	if ($("#message").val().trim().length) {
		createChatMessage($("#message").val(), me.username, me.avatar, moment());
		scrollToBottom();

		// Send the message to the other person in the chat
		socket.emit('msg', { msg: $("#message").val(), from: me.id, to: currentChatName, img: me.avatar });

	}
	// Empty the textarea
	$("#message").val("");
	$("#message").focus();
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

// Menu collapse Js Script 
$('#sidebarCollapse').on('click', function () {
	$('#sidebar, #content').toggleClass('active');
	$('.collapse.in').toggleClass('in');
	$('a[aria-expanded=true]').attr('aria-expanded', 'false');
});


function reqChatBy(chat) {
	currentChatName = chat;
	document.getElementById(chat).style.backgroundColor = "#123456"; // jquery exception in "|"
	var roomKey = myRoomData[chat];
	if (roomKey == null) {
		socket.emit("request", { room: chat });
		// todo: 
	}
	else { // me already joined in chat
		showMessage("chatStarted", chat);
	}
}

function getUserLink(user) {
	var chat = generateChatRoomName(user.id);
	return "<a href='javascript:reqChatBy(\"" + chat + "\");'>" +
		"<div class='user'>" +
		"<img class='user-avatar' src='" + user.avatar + "'>" +
		"<div class='wait' id='" + chat + "'></div>" +
		"<div style='margin-top: 12px'>&nbsp;" +
		"<img src='img/" + user.status + "_status.png' height='16' width='16'>" + user.username +
		"</div>" +
		"</div></a>";
}


function generateChatRoomName(userid) {
	var ids = [me.id, userid].sort();
	return ids[0] + "|" + ids[1]; // unique name for this users private 
}

function addMyRoom(room, symmetricKey) {
	myRoomData[room] = symmetricKey;
	localStorage.myRooms === JSON.stringify(myRoomData);
}

function setConnectionStatus(state) {
	if (state === "connected") {
		$("#disconnected").fadeOut(1, () =>
			$("#connecting").fadeOut(1, () =>
				$("#connected").fadeIn()));
	}
	else if (state === "disconnected") {
		$("#connected").fadeOut(1, () =>
			$("#connecting").fadeOut(1, () =>
				$("#disconnected").fadeIn()));
	}
	else if (state === "connecting") {
		$("#connected").fadeOut(1, () =>
			$("#disconnected").fadeOut(1, () =>
				$("#connecting").fadeIn()));
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
	$("html, body").animate({ scrollTop: $(document).height() - $(window).height() }, 100);
}

function isValid(thatemail) {

	var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(thatemail);
}

function showMessage(status, data) {

	if (status === "connected") {
		$("#screen").html(
			"<div class='connected'>" +
			"<img src='../img/unnamed.png' id='creatorImage' />" +
			"<div class='infoConnected'>" +
			"<h2>Who are you?</h2>" +
			"<br/>" +
			"<form class='loginForm'>" +
			"<input type='text' id='yourName' placeholder='Your nick name' />" +
			"<br/>" +
			"<input type='email' id='yourEmail' placeholder='Your email address' />" +
			"<br/>" +
			"<input type='password' id='yourPass' placeholder='Your password' />" +
			"<br/>" +
			"<button type='submit' id='yourEnter'>ENTER</button>" +
			"</form>" +
			"</div>" +
			"</div>");
	}

	else if (status === "signedin") {
		$("#screen").html(
			"<div style='text-align: center;'>" +
			"<h2>Please select a chat to start messaging</h2>" +
			"</div>");
	}

	else if (status === "chatStarted") {

		$("#screen").html(
			"<div class='chatscreen'><ul class='chats'>" +
			"<!-- The chat messages will go here --></ul></div>");
	}
}