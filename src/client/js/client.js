/* This file is executed in the browser, when people visit /   */
"use strict";

// variables which hold the data for each person
var socket = io(), // connect to the socket
	lstUsers = null,
	lstChannels = null,
	currentChannelName = "",
	channelMessages = {},
	channels = null,
	state = ["offline", "online"], // 0: offline, 1: online
	lstTypingUser = {},
	keys = getCipherKeys();

// on connection to server get the id of person's channel
socket.on("connect", () => {
	console.log(`connected by socket.id: ${socket.id}`)
	setConnectionStatus("connected");
	var me = getMe();
	if (me && localStorage.hashedPass) {
		// nonce password
		me.password = getNoncePassword(localStorage.hashedPass);
		socket.emit('login', me);
	}
});

// when me sign-in was expired from server time
socket.on("resign", () => {
	var me = getMe();
	$(".login100-form-title").html("Login");
	$("#yourName").val(me.username);
	$("#yourEmail").val(me.email);
	$("#yourAvatar").attr("src", me.avatar);
});

// when me disconnected from server then changed my profile status to offline mode
socket.on("disconnect", () => {
	console.warn(`socket <${getMe().socketid}> disconnected!`);
	setConnectionStatus("disconnected");
});

// on exception occurred from server call
socket.on("exception", err => {
	alert(err);
});

// save the my user data when I signed-in to server successfully
socket.on('signed', signedin);

// update users and channels data when thats status changed
socket.on('update', data => {
	lstUsers = data.users;
	lstChannels = data.channels;
	$("#userContacts").empty();
	$("#channelContacts").empty();

	delete lstUsers[getMe().id]; // remove me from users list
	for (var prop in lstUsers) {
		var user = lstUsers[prop];
		var channel = getChannelName(user.id);
		$("#userContacts").append("<li id='" + channel + "' class='contact'>" + getUserLink(user, channel) + "</li>");
	}

	for (var prop in lstChannels) {
		var channel = lstChannels[prop];
		$("#channelContacts").append("<li id='" + channel.name + "' class='contact'>" + getChannelLink(channel) + "</li>")
	};

	if (currentChannelName != null && currentChannelName.length > 0) {
		chatStarted(currentChannelName);
	}
});

// when a client socket disconnected or a channel admin be offline
socket.on('leave', leftedUser => {
	var u = lstUsers[leftedUser.id];
	if (u != null) {
		u.status = leftedUser.status;
		var chat = getChannelName(u.id);
		$(`#${getChannelName(u.id)}`).html(getUserLink(u, chat))
	}
});

// on a user requested to chat by me or join to the channel which is me admin of 
socket.on('request', data => {
	var reqUser = lstUsers[data.from];
	if (reqUser == null) {
		socket.emit("reject", { to: data.from, channel: data.channel, msg: "I don't know who requested!" });
		return; // incorrect request from
	}

	var reqChannel = getChannels()[data.channel];

	if (reqChannel == null) {  // dose not exist in channel list, so it's a new p2p channel!
		// ask me to accept or reject user request
		if (confirm(`Do you allow <${reqUser.username}> to chat with you?`) == false) {
			socket.emit("reject", { to: data.from, channel: data.channel });
			return;
		}
		// wow, accepted...
		createChannel(data.channel, true);
		reqChannel = getChannels()[data.channel];
	}
	else if (reqChannel.p2p === false) {
		// ask me to accept or reject user request
		if (confirm(`Do you allow <${reqUser.username}> to join in <${reqChannel.name}> channel?`) == false) {
			socket.emit("reject", { to: data.from, channel: data.channel });
			return;
		}
	}
	// encrypt the chat symmetricKey by requested user public key
	var encryptedChannelKey = reqChannel.channelKey.asymEncrypt(data.pubKey)
	//
	// send data to requester user to join in current channel
	socket.emit("accept", { to: data.from, channelKey: encryptedChannelKey, channel: reqChannel.name })
	chatStarted(reqChannel.name);
});

// when my chat request accepted by channel admin
socket.on('accept', data => {
	// decrypt RSA cipher by my pricate key
	var symmetricKey = data.channelKey.asymDecrypt(keys.privateKey);
	//
	// store this channel to my channels list
	setChannel(data.channel, { name: data.channel, p2p: data.p2p, channelKey: symmetricKey });
	chatStarted(data.channel);
});

// when my chat request rejected by channel admin
socket.on('reject', data => {
	var admin = lstUsers[data.from];
	var reason = data.msg == null ? "" : "because " + data.msg;
	if (data.p2p)
		alert(`Your request to chat by <${admin.username}> rejected. ${reason}`);
	else
		alert(`Your join request to <${data.channel}> channel rejected. ${reason}`);

	$(`#${data.channel}`).find(".wait").css("display", "none");
});

// when a messsage sent to me or channel which is I member in
socket.on('receive', data => {
	if (currentChannelName == data.to)  // from current chat
		appendMessage(data);
	else {
		// keep in buffer for other time view
		data.state = "replies";
		//
		// increase badge
		var badge = $(`#${data.to}`).find(".badge");
		var badgeVal = badge.attr("data-badge");
		if (badgeVal == "") badgeVal = 0;
		badge.attr("data-badge", parseInt(badgeVal) + 1);
	}

	getMessages(data.to).push(data);
});

// when get response of my requests to fetch history of the chat messages
socket.on('fetch-messages', data => {
	if (data.messages == null)
		data.messages == []; // set to un-null to except next time requests
	channelMessages[data.channel] = data.messages;
	updateMessages();
});

socket.on('error', () => {
	console.log("Client: error");
	socket.socket.reconnect();
});


// on a user typing in a associated chat with me 
socket.on("typing", data => {
	var user = lstUsers[data.user];
	var channel = getChannels()[data.channel];
	if (channel && user && channel.name === currentChannelName) {
		lstTypingUser[user.username] = Date.now();
		updateTypingUsers(channel);
		var timeout = 10000; // 10sec
		setTimeout(() => {
			for (var u in lstTypingUser)
				if (lstTypingUser[u] + timeout - 2000 < Date.now()) {
					// clear old typing state users
					delete lstTypingUser[u];
				}

			updateTypingUsers(channel);
		}, timeout);
	}
});

//
//
// 
// ------------------------------------ utilitie functions -------------------------------------
// 
//
function updateTypingUsers(channel) {
	var typingSpan = $("#channel-user-typing");

	if (Object.keys(lstTypingUser).length > 0) {
		if (channel.p2p)
			typingSpan.html(`is typing...`);
		else {
			var names = Object.getOwnPropertyNames(lstTypingUser);
			var usernames = names.slice(0, 3).join(", ");
			if (names.length > 3)
				usernames += " and others are";
			else if (names.length <= 1)
				usernames += " is";
			else
				usernames += " are";

			typingSpan.html(`${usernames} typing...`);
		}

		typingSpan.css("display", "flex");
	}
	else {
		typingSpan.css("display", "none");
	}
}

function reqChatBy(name) {
	$(`#${name}`).find(".wait").css("display", "block");
	var channel = getChannels()[name];

	if (channel && channel.channelKey) { // me already joined in chat
		chatStarted(name);
	}
	else {
		socket.emit("request", { channel: name, pubKey: keys.publicKey });
	}
}

function getUserLink(user, channel) {
	return `<div class='wrap' onclick='reqChatBy("${channel}")'>
				<span class='contact-status ${user.status}'></span>
				<img src='${user.avatar}' />
				<div class='wait'></div>
				<div class='meta'>
					<p class='name badge' data-badge=''>${user.username}</p>
				</div>
			</div>`;
}

function getChannelLink(channel) {
	return `<div class='wrap' onclick='reqChatBy("${channel.name}")'>				
				<img src='img/channel.png' />
				<div class='wait'></div>
				<div class='meta'>
					<p class='name badge' data-badge=''>${channel.name}</p>
				</div>
			</div>`;
}

function getChannelName(userid) {
	var ids = [getMe().id, userid].sort();
	return `${ids[0]}_${ids[1]}`; // unique name for this users private 
}

// set channels thread safe
function setChannel(name, channel) {
	getChannels()[name] = channel;
	localStorage.channels = JSON.stringify(getChannels());
}

function getChannels() {
	if (channels)
		return channels;

	if (localStorage.channels)
		channels = JSON.parse(localStorage.channels)
	else {
		channels = {};
		localStorage.channels = "{}"; // store string of object
	}

	return channels;
}

function setMe(data) {
	var lastMe = getMe();

	if (lastMe && lastMe.serverVersion !== data.serverVersion) {
		// server restarted, so refresh cached data
		localStorage.channels = "{}";
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

function chatStarted(channel) {
	currentChannelName = channel;
	$("li").removeClass("active");
	var contact = $(`#${channel}`);
	contact.addClass("active");
	contact.find(".badge").attr("data-badge", ""); // remove badge
	$("#channel-profile-img").attr("src", contact.find("img").attr("src"))
	$("#channel-profile-name").html(contact.find(".name").html())
	contact.find(".wait").css("display", "none");

	updateMessages();
}

function signedin(me) {
	console.info(`I signed-in by socket <${me.socketid}>`);
	setMe(me);
	$("title").html(`Secure Chat - ${me.username}`)
	$("#profile-img").attr("src", me.avatar);
	$("#myUsername").html(me.username);
	$("#myEmail").val(me.email);
	$(".limiter").remove();
	$("#frame").css("display", "block");
}

function updateMessages() {
	// show old messages
	var messages = getMessages(currentChannelName);

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

	if (currentChannelName == null || currentChannelName == '') {
		alert("Please first select a chat to sending message!");
		return false;
	}

	// get channel symmetric key and encrypt message
	var chatSymmetricKey = getChannels()[currentChannelName].channelKey;
	var msg = message.symEncrypt(chatSymmetricKey)

	// Send the message to the chat channel
	socket.emit('msg', { msg: msg, from: getMe().id, to: currentChannelName, avatar: getMe().avatar });

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
	if (lstChannels[data.to]) { // if is a real channel
		data.msgHeader = `<b>${data.name}</b><br />`
	}

	// get this channel symmetric key to decrypt message
	var symmetricKey = getChannels()[currentChannelName].channelKey;
	var msg = data.msg.symDecrypt(symmetricKey)

	// add to self screen
	var messagesScreen = $(".messages");
	messagesScreen.find("ul").append(`<li class="${data.state}"><img src="${data.avatar}" title="${data.name}" /><p>${data.msgHeader}${msg}</p></li>`); // append message to end of page
	messagesScreen.scrollTop(messagesScreen[0].scrollHeight); // scroll to end of messages page
}

function getMessages(channel) {
	var msgArray = channelMessages[channel];
	if (msgArray == null) {
		// fetch from server
		socket.emit("fetch-messages", channel);
		return [];
	}
	else
		return msgArray;
}

function createChannel(channel, p2p) {
	if (lstChannels[channel])
		return false;

	// my socket is admin for this channel
	// generate symmetric key 
	var symmetricKey = generateKey(50);
	//
	// store this channel to my channels list
	setChannel(channel, { name: channel, p2p: p2p, channelKey: symmetricKey });

	return true;
}

// create nonce password by socket.id
function getNoncePassword(pass) {
	return pass.symEncrypt(socket.id);
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
	[ Expand profile ]*/
	$(".expand-button").click(function () {
		$("#profile").toggleClass("expanded");
		$("#contacts").toggleClass("expanded");
	});

	/*==================================================================
	[ Press Enter to send message ]*/
	$('.submit').click(function () {
		newMessage();
	});

	$(window).on('keydown', function (e) {
		// notify user is typing...
		if (currentChannelName != null && currentChannelName.length > 0)
			socket.emit("typing", currentChannelName)

		if (e.which == 13) {
			newMessage();
		}
	});

	/*==================================================================
	[ Press Enter to login ]*/
	$(".validate-input").on('keydown', function (e) {
		if (e.which == 13) {
			$("#loginButton").click();
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
				// send data to requester user to join in current channel
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

	// Submit login div 
	$("#loginButton").on('click', () => {
		// validation data
		var check = true;
		for (var i = 0; i < input.length; i++) {
			if (validate(input[i]) == false) {
				showValidate(input[i]);
				check = false;
			}
		}

		if (check) { // if login data is valid then:
			var name = $.trim($("#yourName").val());
			var email = $("#yourEmail").val();
			var pass = $("#yourPass").val();
			localStorage.hashedPass = pass.getHash(); // store my login password by hashing
			var noncePass = getNoncePassword(localStorage.hashedPass);
			socket.emit('login', { username: name, email: email, password: noncePass });
		}
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