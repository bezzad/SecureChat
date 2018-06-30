/* This file is executed in the browser, when people visit /   */
"use strict";

// variables which hold the data for each person
var socket = io(), // connect to the socket
	lstUsers = null,
	lstRooms = null,
	currentChatName = "",
	roomMessages = {},
	state = ["offline", "online"], // 0: offline, 1: online
	keys = getCipherKeys();

// on connection to server get the id of person's room
socket.on("connect", () => {
	setConnectionStatus("connected");
	console.log(`connected by socket.id: ${socket.id}`)

	if (getMe())
		socket.emit('login', getMe());
});

// when me disconnected from server then changed my profile status to offline mode
socket.on("disconnect", () => setConnectionStatus("disconnected"));

// on exception occurred from server call
socket.on("exception", err => {
	alert(err);
});

// save the my user data when I signed-in to server successfully
socket.on('signed', signedin);

// update users and rooms data when thats status changed
socket.on('update', data => {
	lstUsers = data.users;
	lstRooms = data.rooms;
	$("#userContacts").empty();
	$("#channelContacts").empty();

	delete lstUsers[getMe().id]; // remove me from users list
	for (var prop in lstUsers) {
		var user = lstUsers[prop];
		var channel = getChannelName(user.id);
		$("#userContacts").append("<li id='" + channel + "' class='contact'>" + getUserLink(user, channel) + "</li>");
	}

	for (var prop in lstRooms) {
		var room = lstRooms[prop];
		$("#channelContacts").append("<li id='" + room.name + "' class='contact'>" + getChannelLink(room) + "</li>")
	};

	if (currentChatName != null && currentChatName.length > 0) {
		chatStarted(currentChatName);
	}
});

// when a client socket disconnected or a room admin be offile
socket.on('leave', leftedUser => {
	var u = lstUsers[leftedUser.id];
	if (u != null) {
		u.status = leftedUser.status;
		var chat = getChannelName(u.id);
		$(`#${getChannelName(u.id)}`).html(getUserLink(u, chat))
	}
});

// on a user requested to chat by me or join to the room which is me admin of 
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
		createChannel(data.room, true);
		reqRoom = getRooms()[data.room];
	}
	else if (reqRoom.p2p === false) {
		// ask me to accept or reject user request
		if (confirm(`Do you allow <${reqUser.username}> to join in <${reqRoom.name}> room?`) == false) {
			socket.emit("reject", { to: data.from, room: data.room });
			return;
		}
	}
	// encrypt the chat symmetricKey by requested user public key
	var encryptedChannelKey = reqRoom.chatKey.asymEncrypt(data.pubKey)
	//
	// send data to requester user to join in current room
	socket.emit("accept", { to: data.from, chatKey: encryptedChannelKey, room: reqRoom.name })
	chatStarted(reqRoom.name);
});

// when my chat request accepted by channel admin
socket.on('accept', data => {
	// decrypt RSA cipher by my pricate key
	var symmetricKey = data.chatKey.asymDecrypt(keys.privateKey);
	//
	// store this room to my rooms list
	setRooms(data.room, { name: data.room, p2p: data.p2p, chatKey: symmetricKey });
	chatStarted(data.room);
});

// when my chat request rejected by channel admin
socket.on('reject', data => {
	var admin = lstUsers[data.from];
	var reason = data.msg == null ? "" : "because " + data.msg;
	if (data.p2p)
		alert(`Your request to chat by <${admin.username}> rejected. ${reason}`);
	else
		alert(`Your join request to <${data.room}> channel rejected. ${reason}`);

	$(`#${data.room}`).find(".wait").css("display", "none");
});

// when a messsage sent to me or room which is I member in
socket.on('receive', data => {
	if (currentChatName == data.to)  // from current chat
		appendMessage(data);
	else // keep in buffer for other time view
		data.state = "replies";

	getMessages(data.to).push(data);
});

// when get response of my requests to fetch history of the chat messages
socket.on('fetch-messages', data => {
	if (data.messages == null)
		data.messages == []; // set to un-null to except next time requests
	roomMessages[data.room] = data.messages;
	updateMessages();
});

socket.on('error', function () {
	console.log("Client: error");
	socket.socket.reconnect();
});
//
//
// 
// ------------------------------------ utilitie functions -------------------------------------
// 
//
function reqChatBy(chat) {
	$(`#${chat}`).find(".wait").css("display", "block");
	var room = getRooms()[chat];
	if (room == null) {
		socket.emit("request", { room: chat });
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
	return `<div class='wrap' onclick='reqChatBy("${room.name}")'>
				<span class='contact-status ${room.status}'></span>
				<img src='img/channel.png' />
				<div class='wait'></div>
				<div class='meta'>
					<p class='name'>${room.name}</p>
				</div>
			</div>`;
}

function getChannelName(userid) {
	var ids = [getMe().id, userid].sort();
	return `${ids[0]}_${ids[1]}`; // unique name for this users private 
}

function setRooms(name, room) {
	var rooms = getRooms();
	rooms[name] = room;
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
	$(".limiter").remove();
	$("#frame").css("display", "block");
}

function updateMessages() {
	// show old messages
	var messages = getMessages(currentChatName);
	var room = getRooms()[currentChatName];

	// add all messages to screen
	var lstMessagesDom = $('.messages ul');
	lstMessagesDom.empty(); // clear screen
	for (var i in messages) {
		appendMessage(messages[i]);
	}
}

function newMessage() {
	var message = $(".message-input input").val();
	if ($.trim(message) == '') {
		return false;
	}

	if (currentChatName == null || currentChatName == '') {
		alert("Please first select a chat to sending message!");
		return false;
	}

	// get channel symmetric key and encrypt message
	var chatSymmetricKey = getRooms()[currentChatName].chatKey;
	var msg = message.symEncrypt(chatSymmetricKey)

	// Send the message to the chat channel
	socket.emit('msg', { msg: msg, from: getMe().id, to: currentChatName, avatar: getMe().avatar });

	// Empty the message input
	$('.message-input input').val(null);
	$('.message-input input').focus();
};

function appendMessage(data) {
	if (data.from == getMe().id) {
		data.state = "sent";
		data.name = getMe().username;
	} else {
		data.state = "replies"
		data.name = lstUsers[data.from].username;
	}

	data.msgHeader = "";
	if (lstRooms[data.to]) { // if is a real channel
		data.msgHeader = `<b>${data.name}</b><br />`
	}

	// get this channel symmetric key to decrypt message
	var symmetricKey = getRooms()[currentChatName].chatKey;
	var msg = data.msg.symDecrypt(symmetricKey)

	// add to self screen
	var messagesScreen = $(".messages");
	messagesScreen.find("ul").append(`<li class="${data.state}"><img src="${data.avatar}" title="${data.name}" /><p>${data.msgHeader}${msg}</p></li>`); // append message to end of page
	messagesScreen.scrollTop(messagesScreen[0].scrollHeight); // scroll to end of messages page
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

function createChannel(channel, p2p) {
	if (lstRooms[channel])
		return false;

	// my socket is admin for this channel
	// generate symmetric key 
	var symmetricKey = generateKey(50);
	//
	// store this room to my rooms list
	setRooms(channel, { name: channel, p2p: p2p, chatKey: symmetricKey });

	return true;
}

//
//
// 
// ------------------------------------ Jquery DOM Events -------------------------------------
// 
//
(function ($) {
	"use strict";

	/*==================================================================
	[ Submit login div ]*/
	$("#loginButton").on('click', () => {	

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

		socket.emit('login', { username: name, email: email, password: pass.getHash(), pubKey: keys.publicKey });
	});

	/*==================================================================
	[ Expand profile ]*/
	$(".expand-button").click(function () {
		$("#profile").toggleClass("expanded");
		$("#contacts").toggleClass("expanded");
	});

	/*==================================================================
	[ Enter send message ]*/
	$('.submit').click(function () {
		newMessage();
	});

	$(window).on('keydown', function (e) {
		if (e.which == 13) {
			newMessage();
			return false;
		}
	});

	/*==================================================================
	[ Focus input ]*/
	$('.input100').each(function () {
		$(this).on('blur', function () {
			if ($(this).val().trim() != "") {
				$(this).addClass('has-val');
			}
			else {
				$(this).removeClass('has-val');
			}
		})
	})

	/*==================================================================
	[ Add channel button ]*/
	$("#addchannel").on("click", () => {
		var name = prompt("Please enter channel name:", "Channel");
		if (name) {
			name = name.replace(/ /g, "_"); // replace all space to _
			if (createChannel(name, false)) {
				// send data to requester user to join in current room
				socket.emit("createChannel", name);
			}
			else {
				alert(`The <${name}> channel name already exist`);
			}
		}
	})

	/*==================================================================
	[ Validate ]*/
	var input = $('.validate-input .input100');

	$('.validate-form').on('submit', function () {
		var check = true;

		for (var i = 0; i < input.length; i++) {
			if (validate(input[i]) == false) {
				showValidate(input[i]);
				check = false;
			}
		}

		return check;
	});


	$('.validate-form .input100').each(function () {
		$(this).focus(function () {
			hideValidate(this);
		});
	});

	function validate(input) {
		if ($(input).attr('type') == 'email' || $(input).attr('name') == 'email') {
			if ($(input).val().trim().match(/^([a-zA-Z0-9_\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\.)+))([a-zA-Z]{1,5}|[0-9]{1,3})(\]?)$/) == null) {
				return false;
			}
		}
		else {
			if ($(input).val().trim() == '') {
				return false;
			}
		}
	}

	function showValidate(input) {
		var thisAlert = $(input).parent();

		$(thisAlert).addClass('alert-validate');
	}

	function hideValidate(input) {
		var thisAlert = $(input).parent();

		$(thisAlert).removeClass('alert-validate');
	}

})(jQuery);