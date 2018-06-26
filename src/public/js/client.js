// This file is executed in the browser, when people visit /chat

// variables which hold the data for each person
var socket = io(), // connect to the socket
	me = null, // keep my info, username, avatar, ...
	lstUsers = null,
	lstRooms = null,
	currentChatName = "",
	roomMessages = {},
	state = ["offline", "online"], // 0: offline, 1: online
	sh512Hasing = forge.md.sha512.create(),
	myRoomData = localStorage.myRooms == null
		? {}
		: JSON.parse(localStorage.myRooms);

// on connection to server get the id of person's room
socket.on("connect", () => {
	setConnectionStatus("connected");

	if (localStorage.me == null) {
		$("#loginForm").on('submit', function (e) {
			e.preventDefault();

			var name = $.trim($("#yourName").val());
			if (name.length < 1) {
				alert("Please enter a nick name longer than 1 character!");
				return;
			}

			var email = $("#yourEmail").val();
			if (email.length < 5) {
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
	setConnectionStatus("disconnected");
});


socket.on("exception", err => {
	alert(err);
});


// save the my user data
socket.on('signed', data => {
	me = data;
	me.lastLoginDate = Date.now();
	localStorage.me = JSON.stringify(me);
	$("#profile-img").attr("src", me.avatar);
	$("#myUsername").html(me.username);
	$("#myEmail").val(me.email);

	showMessage("signedin", me);
});


// update users and rooms data
socket.on('update', data => {
	lstUsers = data.users;
	lstRooms = data.rooms;
	$("#userContacts").empty();
	$("#channelContacts").empty();

	delete lstUsers[me.id]; // remove me from users list
	for (prop in lstUsers) {
		var user = lstUsers[prop];
		var chat = getChannelName(user.id);
		$("#userContacts").append("<li id='" + chat + "' class='contact'>" + getUserLink(user, chat) + "</li>");
	}

	for (prop in lstRooms) {
		var room = lstRooms[prop];
		$("#channelContacts").append("<li id='" + room.roomName + "' class='contact'>" + getChannelLink(room) + "</li>")
	};

	if (currentChatName != null && currentChatName.length > 0) {
		showMessage("startChat", currentChatName);
	}
});


// when a client socket disconnected
socket.on('leave', leftedUser => {
	var u = lstUsers[leftedUser.id];
	if (u != null) {
		u.status = leftedUser.status;
		var chat = getChannelName(u.id);
		$("#" + getChannelName(u.id)).html(getUserLink(u, chat))
	}
});


// on a user join request to the chat's which me is admin of 
socket.on('request', data => {
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
	showMessage("chatStarted", data.room);
});


socket.on('accept', data => {
	console.log("room [" + data.room + "] is now open.");
	var admin = lstUsers[data.from];
	var symmetricKey = data.chatKey + "decryptByMyPrivateKey";
	//
	// store this room to my rooms list
	addMyRoom(data.room, { room: data.room, p2p: data.p2p, chatKey: symmetricKey });
	showMessage("chatStarted", data.room);
});


socket.on('reject', data => {
	var admin = lstUsers[data.from];
	var reason = data.msg == null ? "" : data.msg;
	if (data.p2p)
		alert("The user <" + admin.username + "> rejected your chat request. " + reason);
	else
		alert("The user <" + admin.username + "> as admin of <" + data.room + ">, rejected your chat request. " + reason);

	$("#" + data.room).find(".wait").css("display", "none");
});


socket.on('receive', data => {
	if (currentChatName == data.to)  // from current chat
		addMessage(data);
	else // keep in buffer for other time view
		getMessages(data.to).push(data);
});

socket.on('fetch-messages', data => {
	if (data.messages == null)
		data.messages == [];
	roomMessages[data.room] = data.messages;
});

function reqChatBy(chat) {
	$("#" + chat).find(".wait").css("display", "block");
	var roomKey = myRoomData[chat];
	if (roomKey == null) {
		socket.emit("request", { room: chat });
		// todo: 
	}
	else { // me already joined in chat
		showMessage("chatStarted", chat);
	}
}

function getUserLink(user, chat) {
	return "<div class='wrap' onclick='reqChatBy(\"" + chat + "\")'>" +
		"<span class='contact-status " + user.status + "'></span>" +
		"<img src='" + user.avatar + "' />" +
		"<div class='wait'></div>" +
		"<div class='meta'>" +
		"<p class='name'>" + user.username + "</p>" +
		"</div></div>";
}

function getChannelLink(room) {
	return "<div class='wrap' onclick='reqChatBy(\"" + room.roomName + "\")'>" +
		"<span class='contact-status away'></span>" +
		"<img src='img/unnamed.png' />" +
		"<div class='wait'></div>" +
		"<div class='meta'>" +
		"<p class='name'>" + room.roomName + "</p>" +
		"</div></div>";
}

function getChannelName(userid) {
	var ids = [me.id, userid].sort();
	return ids[0] + "_" + ids[1]; // unique name for this users private 
}

function addMyRoom(room, symmetricKey) {
	myRoomData[room] = symmetricKey;
	localStorage.myRooms === JSON.stringify(myRoomData);
}

function setConnectionStatus(state) {
	$("#profile-img").removeClass();

	if (state === "connected") {
		$("#profile-img").addClass('online');
	}
	else if (state === "disconnected") {
		$("#profile-img").addClass('offline');
	}
}

function showMessage(status, room) {
	if (status === "signedin") {
		$(".limiter").css("display", "none");
		$("#frame").css("display", "block");
	}

	else if (status === "chatStarted") {
		currentChatName = room;
		$("li").removeClass("active");
		var contact = $("#" + room);
		contact.addClass("active");
		$("#channel-profile-img").attr("src", contact.find("img").attr("src"))
		$("#channel-profile-name").html(contact.find(".name").html())
		contact.find(".wait").css("display", "none");

		// show old messages
		var msgs = getMessages(room);
		var roomKey = myRoomData[room];
		// todo: add all messages to screen
	}
}


function newMessage() {
	message = $(".message-input input").val();
	if ($.trim(message) == '') {
		return false;
	}

	if (currentChatName == null || currentChatName == '') {
		alert("Please first select a chat to sending message!");
		return false;
	}

	// Send the message to the other person in the chat
	var data = { msg: message, from: me.id, to: currentChatName, avatar: me.avatar };
	socket.emit('msg', data);

	addMessage(data);

	// Empty the message input
	$('.message-input input').val(null);
	$('.message-input input').focus();
};

function addMessage(data) {
	data.state = "replies"
	if (data.from == me.id)
		data.state = "sent";

	// store messages in local
	getMessages(data.to).push(data);

	// add to self screen
	$('<li class="' + data.state + '"><img src="' + data.avatar + '" /><p>' + data.msg + '</p></li>').appendTo($('.messages ul'));
	$(".messages").animate({ scrollTop: $(document).height() }, "fast");
}


function getMessages(room) {
	var msgArray = roomMessages[room];
	if (msgArray == null) {
		// fetch from server
		socket.emit("fetch-messages", room);
		return roomMessages[room] = [];
	}
	else
		return msgArray;
}

$(".messages").animate({ scrollTop: $(document).height() }, "fast");

$(".expand-button").click(function () {
	$("#profile").toggleClass("expanded");
	$("#contacts").toggleClass("expanded");
});

$('.submit').click(function () {
	newMessage();
});

$(window).on('keydown', function (e) {
	if (e.which == 13) {
		newMessage();
		return false;
	}
});