// This file is executed in the browser, when people visit /chat

// variables which hold the data for each person
var socket = io(), // connect to the socket
	lstUsers = null,
	lstRooms = null,
	currentChatName = "",
	roomMessages = {},
	state = ["offline", "online"], // 0: offline, 1: online
	sh512Hasing = forge.md.sha512.create();

// on connection to server get the id of person's room
socket.on("connect", () => {
	setConnectionStatus("connected");

	if (getMe() == null) {
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
		socket.emit('login', getMe());
	}
});


socket.on("disconnect", () => {
	setConnectionStatus("disconnected");
});


socket.on("exception", err => {
	alert(err);
});


// save the my user data
socket.on('signed', signedin);


// update users and rooms data
socket.on('update', data => {
	lstUsers = data.users;
	lstRooms = data.rooms;
	$("#userContacts").empty();
	$("#channelContacts").empty();

	delete lstUsers[getMe().id]; // remove me from users list
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
		chatStarted(currentChatName);
	}
});


// when a client socket disconnected
socket.on('leave', leftedUser => {
	var u = lstUsers[leftedUser.id];
	if (u != null) {
		u.status = leftedUser.status;
		var chat = getChannelName(u.id);
		$(`#${getChannelName(u.id)}`).html(getUserLink(u, chat))
	}
});


// on a user join request to the chat's which me is admin of 
socket.on('request', data => {
	var reqUser = lstUsers[data.from];
	if (reqUser == null) {
		socket.emit("reject", { to: data.from, room: data.room, msg: "I don't know who requested!" });
		return; // incorrect request from
	}

	var reqRoom = getRooms()[data.room];

	if (reqRoom == null) {  // dose not exist in room list, so it's a new p2p room!
		// ask me to accept or reject user request
		if (confirm(`Do you allow <${reqUser.username}> to chat with you?`) == false) {
			socket.emit("reject", { to: data.from, room: data.room });
			return;
		}
		// wow, accepted...
		// Now, my socket is admin for requested room
		// generate symmetric key 
		var symmetricKey = "symmetricKeyForThisRoom";
		//
		// store this room to my rooms list
		setRooms(data.room, { room: data.room, p2p: true, chatKey: symmetricKey });
	}
	else if (reqRoom.p2p == false) {
		// ask me to accept or reject user request
		if (confirm(`Do you allow <${reqUser.username}> to join in <${reqRoom.roomName}> room?`) == false) {
			socket.emit("reject", { to: data.from, room: data.room });
			return;
		}
	}

	// and encrypt that by requester public key
	var encSymmetricKey = getRooms()[data.room].chatKey + data.pubKey + "EncryptedByAnotherUserPubKey";
	//
	// send data to requester user to join in current room
	socket.emit("accept", { to: data.from, chatKey: encSymmetricKey, room: data.room })
	chatStarted(data.room);
});


socket.on('accept', data => {
	console.log("room [" + data.room + "] is now open.");
	var symmetricKey = data.chatKey + "decryptByMyPrivateKey";
	//
	// store this room to my rooms list
	setRooms(data.room, { room: data.room, p2p: data.p2p, chatKey: symmetricKey });
	chatStarted(data.room);
});


socket.on('reject', data => {
	var admin = lstUsers[data.from];
	var reason = data.msg == null ? "" : data.msg;
	if (data.p2p)
		alert(`The user <${admin.username}> rejected your chat request. ${reason}`);
	else
		alert(`The user <${admin.username}> as admin of <${data.room}>, rejected your chat request. ${reason}`);

	$(`#${data.room}`).find(".wait").css("display", "none");
});


socket.on('receive', data => {
	if (currentChatName == data.to)  // from current chat
		addMessage(data);
	else // keep in buffer for other time view
		data.state = "replies";
	getMessages(data.to).push(data);
});

socket.on('fetch-messages', data => {
	if (data.messages == null)
		data.messages == []; // set to un-null to except next time requests
	roomMessages[data.room] = data.messages;
	updateMessages();
});

function reqChatBy(chat) {
	$(`#${chat}`).find(".wait").css("display", "block");
	var roomKey = getRooms()[chat];
	if (roomKey == null) {
		socket.emit("request", { room: chat });
		// todo: 
	}
	else { // me already joined in chat
		chatStarted(chat);
	}
}

function getUserLink(user, chat) {
	return `<div class='wrap' onclick='reqChatBy("${chat}")'>
				<span class='contact-status ${user.status}'></span>
				<img src='${user.avatar}' />
				<div class='wait'></div>
				<div class='meta'>
					<p class='name'>${user.username}</p>
				</div>
			</div>`;
}

function getChannelLink(room) {
	return `<div class='wrap' onclick='reqChatBy("${room.roomName}")'>
				<span class='contact-status ${room.status}'></span>
				<img src='img/unnamed.png' />
				<div class='wait'></div>
				<div class='meta'>
					<p class='name'>${room.roomName}</p>
				</div>
			</div>`;
}

function getChannelName(userid) {
	var ids = [getMe().id, userid].sort();
	return `${ids[0]}_${ids[1]}`; // unique name for this users private 
}

function setRooms(roomName, roomData) {
	var rooms = getRooms();
	rooms[roomName] = roomData;
	localStorage.rooms = JSON.stringify(rooms);
}

function getRooms() {
	var rooms = localStorage.rooms;
	if (rooms == null) {
		localStorage.rooms = "{}"; // store string of object
		return {};
	}

	return JSON.parse(rooms);
}

function setMe(data) {
	var lastMe = getMe();

	if (lastMe != null && lastMe.serverVersion !== data.serverVersion) {
		// server restarted, so refresh cached data
		localStorage.rooms = "{}";
	}
	localStorage.me = JSON.stringify(data);
}

function getMe() {
	var me = localStorage.me;
	if (me == null)
		return null;

	return JSON.parse(me);
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

function chatStarted(room) {
	currentChatName = room;
	$("li").removeClass("active");
	var contact = $(`#${room}`);
	contact.addClass("active");
	$("#channel-profile-img").attr("src", contact.find("img").attr("src"))
	$("#channel-profile-name").html(contact.find(".name").html())
	contact.find(".wait").css("display", "none");

	updateMessages();
}

function signedin(me) {
	me.lastLoginDate = Date.now();
	setMe(me);
	$("#profile-img").attr("src", me.avatar);
	$("#myUsername").html(me.username);
	$("#myEmail").val(me.email);
	$(".limiter").css("display", "none");
	$("#frame").css("display", "block");
}

function updateMessages() {
	// show old messages
	var messages = getMessages(currentChatName);
	var roomKey = getRooms()[currentChatName];

	// add all messages to screen
	var lstMessagesDom = $('.messages ul');
	lstMessagesDom.empty(); // clear screen
	for (i in messages) {
		appendMessage(messages[i]);
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
	var data = { msg: message, from: getMe().id, to: currentChatName, avatar: getMe().avatar };
	socket.emit('msg', data);

	addMessage(data);

	// Empty the message input
	$('.message-input input').val(null);
	$('.message-input input').focus();
};

function addMessage(data) {
	// store messages in local
	getMessages(data.to).push(data);

	appendMessage(data);
}

function appendMessage(data) {
	data.state = "replies"
	if (data.from == getMe().id)
		data.state = "sent";

	// add to self screen
	$(`<li class="${data.state}"><img src="${data.avatar}" /><p>${data.msg}</p></li>`).appendTo('.messages ul');
	$(".messages").animate({ scrollTop: $('.messages')[0].scrollHeight }, "fast");
}

function getMessages(room) {
	var msgArray = roomMessages[room];
	if (msgArray == null) {
		// fetch from server
		socket.emit("fetch-messages", room);
		return [];
	}
	else
		return msgArray;
}

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