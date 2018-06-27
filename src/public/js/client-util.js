// variables which hold the data for each person
var socket = io(), // connect to the socket
	lstUsers = null,
	lstRooms = null,
	currentChatName = "",
	roomMessages = {},
	state = ["offline", "online"], // 0: offline, 1: online
	sh512Hasing = forge.md.sha512.create();

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