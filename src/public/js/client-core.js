// This file is executed in the browser, when people visit /


// on connection to server get the id of person's room
socket.on("connect", () => {
	setConnectionStatus("connected");
	console.log(`connected by socket.id: ${socket.id}`)

	setTimeout(() => {
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
	}, 250);
});

// when me disconnected from server then changed my profile status to offline mode
socket.on("disconnect", () => {
	setConnectionStatus("disconnected");
});

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


// when my chat request accepted by channel admin
socket.on('accept', data => {
	console.log("room [" + data.room + "] is now open.");
	var symmetricKey = data.chatKey + "decryptByMyPrivateKey";
	//
	// store this room to my rooms list
	setRooms(data.room, { room: data.room, p2p: data.p2p, chatKey: symmetricKey });
	chatStarted(data.room);
});


// when my chat request rejected by channel admin
socket.on('reject', data => {
	var admin = lstUsers[data.from];
	var reason = data.msg == null ? "" : data.msg;
	if (data.p2p)
		alert(`The user <${admin.username}> rejected your chat request. ${reason}`);
	else
		alert(`The user <${admin.username}> as admin of <${data.room}>, rejected your chat request. ${reason}`);

	$(`#${data.room}`).find(".wait").css("display", "none");
});


// when a messsage sent to me or room which is I member in
socket.on('receive', data => {
	if (currentChatName == data.to)  // from current chat
		addMessage(data);
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