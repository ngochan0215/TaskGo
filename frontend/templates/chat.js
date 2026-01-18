const API_URL = "http://localhost:3000/api";
const SOCKET_URL = "http://localhost:3000";

const state = {
    token: localStorage.getItem('token'),
    userId: localStorage.getItem('user_id'),
    currentOrderId: new URLSearchParams(window.location.search).get('orderId'),
    currentChatId: null,
    typingTimeout: null,
    nextCursor: null, 
    isLoadingHistory: false,
    partnerAvatar: null,
    partnerName: null,
    callState: 'idle', // idle, calling, connected
    incomingCallOrderId: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isCameraOff: false,
    callTimer: null,
    callSeconds: 0
};

// WebRTC Configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// DOM Elements
const els = {
    msgContainer: document.getElementById('message-container'),
    loadingHistory: document.getElementById('loading-history'), 
    input: document.getElementById('message-input'),
    btnSend: document.getElementById('btn-send'),
    headerName: document.getElementById('chat-header-name'),
    headerScore: document.getElementById('chat-header-score'),
    headerAvatar: document.getElementById('chat-header-avatar'),
    typingIndicator: document.getElementById('chat-typing-indicator'),
    conversationsList: document.getElementById('conversations-list'),
    
    // Call UI - Outgoing/Active
    btnCall: document.getElementById('btn-call'),
    btnEndCall: document.getElementById('btn-end-call'),
    callOverlay: document.getElementById('call-overlay'),
    videoContainer: document.getElementById('video-container'),
    callingUI: document.getElementById('calling-ui'),
    localVideo: document.getElementById('local-video'),
    remoteVideo: document.getElementById('remote-video'),
    callPartnerAvatar: document.getElementById('call-partner-avatar'),
    callPartnerName: document.getElementById('call-partner-name'),
    callStatusLabel: document.getElementById('call-status-label'),
    callTimer: document.getElementById('call-timer'),
    btnToggleMic: document.getElementById('btn-toggle-mic'),
    btnToggleCamera: document.getElementById('btn-toggle-camera'),

    // Call UI - Incoming
    incomingCallOverlay: document.getElementById('incoming-call-overlay'),
    incomingCallAvatar: document.getElementById('incoming-call-avatar'),
    incomingCallName: document.getElementById('incoming-call-name'),
    btnAcceptCall: document.getElementById('btn-accept-call'),
    btnRejectCall: document.getElementById('btn-reject-call')
};

const sounds = {
    ringtone: new Audio("../public/sounds/ringtone.mp3"), 
    end: new Audio("../public/sounds/end_call.mp3"),  
};

// Configure loops
sounds.ringtone.loop = true;

function playSound(type) {
    stopSounds();

    const audio = sounds[type];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn("Audio autoplay blocked:", e));
    }
}

function stopSounds() {
    sounds.ringtone.pause();
    sounds.ringtone.currentTime = 0;
}

// SOCKET INITIALIZATION
let socket;

function initSocket() {
    if (!state.token) {
        alert("Vui lòng đăng nhập");
        window.location.href = '/login.html';
        return;
    }

    socket = io(SOCKET_URL, {
        auth: { token: state.token }, // Sends JWT in handshake
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log("Connected to socket:", socket.id);
        if (state.currentOrderId) {
            joinChatRoom(state.currentOrderId);
        }
    });

    socket.on('connect_error', (err) => {
        console.error("Socket error:", err.message);
    });

    socket.on('receive-message', (payload) => {
        // Only append if it belongs to current chat
        if (payload.chat_id === state.currentChatId) {
            appendMessageToUI(payload);
            //scrollToBottom();
            socket.emit('mark-read', { target_order_id: state.currentOrderId });
        }
    });

    socket.on('start-typing', () => {
        els.typingIndicator.classList.remove('hidden');
    });

    socket.on('stop-typing', () => {
        els.typingIndicator.classList.add('hidden');
    });

    // Call's socket events
    
    socket.on('call:incoming', (payload) => {
        state.incomingCallOrderId = payload.order_id;

        if (payload.caller_name) {
            state.partnerName = payload.caller_name;
        }
        if (payload.caller_avatar) {
            state.partnerAvatar = payload.caller_avatar;
        }

        showIncomingCall();
    });

    socket.on('call:accepted', async (payload) => {
        console.log('Call accepted:', payload);
        stopSounds();
        state.callState = 'connected';
        updateCallUI();
        // We are the caller, create and send offer
        await createAndSendOffer();
    });

    socket.on('call:rejected', (payload) => {
        console.log('Call rejected:', payload);
        endCall(false);
        alert('Cuộc gọi đã bị từ chối');
    });

    socket.on('call:ended', (payload) => {
        console.log('Call ended:', payload);
        if (payload.reason === 'disconnected') {
            alert('Cuộc gọi kết thúc do đối phương thoát khỏi nền tảng.');
        }
        endCall(false);
    });

    socket.on('call:timeout', (payload) => {
        console.log('Call timeout:', payload);
        endCall(false);
        if (state.callState === 'calling') {
            alert('Không có phản hồi');
        }
    });

    // WebRTC: Received offer
    socket.on('call:offer', async (payload) => {
        console.log('Received offer:', payload);
        await handleOffer(payload.offer);
    });

    // WebRTC: Received answer
    socket.on('call:answer', async (payload) => {
        console.log('Received answer:', payload);
        await handleAnswer(payload.answer);
    });

    // WebRTC: Received ICE candidate
    socket.on('call:ice-candidate', async (payload) => {
        console.log('Received ICE candidate');
        await handleIceCandidate(payload.candidate);
    });
}

// MAIN LOGIC

async function init() {
    initSocket();
    setupEventListeners();
    
    loadSidebarConversations(); 

    if (state.currentOrderId) {
        await loadChatHistory(null);
    }
}

async function loadSidebarConversations() {
    try {
        const response = await fetch(`${API_URL}/chats`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const res = await response.json();
        
        const listContainer = document.getElementById('conversations-list');
        listContainer.innerHTML = ""; // Clear "Loading..." text

        if (!res.ok || !res.data || res.data.length === 0) {
            listContainer.innerHTML = `<p class="text-center text-gray-400 text-sm mt-4">Chưa có tin nhắn nào</p>`;
            return;
        }

        res.data.forEach(chat => {
            const isActive = chat.order_id === state.currentOrderId;
            const item = createSidebarItem(chat, isActive);
            listContainer.appendChild(item);
        });

    } catch (err) {
        console.error("Failed to load sidebar:", err);
    }
}

// Join the Socket Room
function joinChatRoom(orderId) {
    socket.emit('join-room', { order_id: orderId }, (response) => {
        if (response.ok) {
            state.currentChatId = response.chatId;
            enableInput(true);
            console.log("Joined room:", state.currentChatId);
        } else {
            console.error("Join room failed:", response.error);
            els.headerName.innerText = "Không thể kết nối chat";
            enableInput(false);
        }
    });
}

// Fetch History from API
async function loadChatHistory(cursor = null) {
    if (state.isLoadingHistory) return;
    state.isLoadingHistory = true;

    // UI: Show loader if paginating
    if (cursor) els.loadingHistory.classList.remove('hidden');

    try {
        // Construct URL with cursor if exists
        let url = `${API_URL}/chats/orders/${state.currentOrderId}/messages`;
        if (cursor) url += `?before=${cursor}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        
        const res = await response.json();
        if (!response.ok) throw new Error(res.message || "Error loading chat");

        const messages = res.data || [];
        
        // Update cursor from backend response
        state.nextCursor = res.nextCursor; 

        if (!cursor) {
            // === INITIAL LOAD ===
            // Clear everything except the loader
            els.loadingHistory.classList.add('hidden');
            
            // Remove old messages
            while (els.msgContainer.lastChild && els.msgContainer.lastChild.id !== 'loading-history') {
                els.msgContainer.removeChild(els.msgContainer.lastChild);
            }

            els.headerName.innerText = `Đơn hàng #${state.currentOrderId.slice(-6).toUpperCase()}`;
            
            if (res.conversation && res.conversation.partner) {
                const { full_name, avatar_url, reputation_score } = res.conversation.partner;
                const orderInfo = res.order;

                state.partnerAvatar = avatar_url;
                state.partnerName = full_name;

                // Update Name
                els.headerName.innerText = full_name;
                
                // Format header
                if (orderInfo) {
                    els.headerName.innerHTML = `
                        ${escapeHtml(full_name)} 
                        <span class="font-normal text-secondary-150 text-xs ml-1">
                            • ${escapeHtml(orderInfo.task_name)}
                        </span>
                    `;
                } else {
                    els.headerName.innerText = full_name;
                }
                
                if (reputation_score !== undefined) {
                     els.headerScore.innerHTML = `
                        <span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[9px] font-bold flex items-center">
                            ${reputation_score.toFixed(1)} 
                            <span class="material-symbols-outlined text-[10px] ml-0.5">star</span>
                        </span>
                    `;
                } else {
                    els.headerScore.innerHTML = "";
                }

                // Update Avatar
                if (els.headerAvatar) {
                    els.headerAvatar.src = avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Julia";
                }
            } else {
                // Fallback if backend didn't send details
                els.headerName.innerText = `Đơn hàng #${state.currentOrderId.slice(-6).toUpperCase()}`;
                els.headerScore.innerHTML = "";
            }

            // Render messages
            messages.forEach(msg => appendMessageToUI(msg));
            scrollToBottom();
        } else {
            // PAGINATION LOAD (PREPEND)
            els.loadingHistory.classList.add('hidden');
            
            if (messages.length > 0) {
                // Save current scroll height to maintain position
                const previousScrollHeight = els.msgContainer.scrollHeight;
                
                prependMessagesToUI(messages);
                
                // Adjust scroll position so user doesn't jump to top
                const newScrollHeight = els.msgContainer.scrollHeight;
                els.msgContainer.scrollTop = newScrollHeight - previousScrollHeight;
            }
        }

        // If we have more history (nextCursor) BUT the content is too short
        // to create a scrollbar (scrollHeight <= clientHeight), the user is "stuck".
        // We must auto-load the next batch immediately.
        if (state.nextCursor && els.msgContainer.scrollHeight <= els.msgContainer.clientHeight) {
            console.log("Content too short to scroll. Auto-loading older messages...");
            // Use setTimeout to allow 'finally' block to run and reset isLoadingHistory flag
            setTimeout(() => {
                loadChatHistory(state.nextCursor);
            }, 100);
        }
    } catch (err) {
        console.error(err);
        if (!cursor) {
             // Only show error text on initial load, not background pagination
            const errDiv = document.createElement('div');
            errDiv.className = "text-center text-red-500 mt-10";
            errDiv.innerText = `Lỗi tải tin nhắn: ${err.message}`;
            els.msgContainer.appendChild(errDiv);
        }
    } finally {
        state.isLoadingHistory = false;
    }
}

function sendMessage() {
    const content = els.input.value.trim();
    if (!content) return;

    socket.emit('send-message', {
        target_order_id: state.currentOrderId,
        content: content
    }, (ack) => {
        if (!ack.ok) {
            alert("Gửi lỗi: " + ack.error);
        }
    });

    // Clear Input
    els.input.value = '';
    socket.emit('stop-typing', { target_order_id: state.currentOrderId });
}

function appendMessageToUI(msg) {
    const div = createMessageElement(msg);
    els.msgContainer.appendChild(div);
}

// UTILS & EVENT LISTENERS

function prependMessagesToUI(messages) {
    // Backend returns [Oldest, ..., Newest] for the requested batch.
    // The visual order of the batch must remain Oldest -> Newest.
    
    // Create a fragment to insert strictly after the loader, but before existing messages
    const fragment = document.createDocumentFragment();
    
    messages.forEach(msg => {
        const msgDiv = createMessageElement(msg); 
        fragment.appendChild(msgDiv);
    });

    // Insert after the loader
    const firstMessage = els.loadingHistory.nextSibling;
    els.msgContainer.insertBefore(fragment, firstMessage);
}

function createMessageElement(msg) {
    const isMe = String(msg.sender_id) === String(state.userId);
    const div = document.createElement('div');
    const time = new Date(msg.createdAt || msg.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    div.className = isMe 
        ? "flex flex-col items-end mb-4 ml-auto max-w-[85%]" 
        : "flex items-end gap-2 mb-4 max-w-[85%]";

    const avatarUrl = state.partnerAvatar || "https://api.dicebear.com/9.x/bottts/svg?seed=Julia";
    if (isMe) {
        div.innerHTML = `
            <div class="bg-green-500 text-white px-4 py-2.5 rounded-2xl rounded-br-none text-sm shadow-md break-words">
                ${escapeHtml(msg.content)}
            </div>
            <span class="text-[10px] text-gray-400 mt-1 mr-1">${time}</span>
        `;
    } else {
        div.innerHTML = `
            <img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm">
            <div class="flex flex-col">
                <div class="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-none text-sm text-dark-900 shadow-sm break-words">
                    ${escapeHtml(msg.content)}
                </div>
                <span class="text-[10px] text-gray-400 mt-1 ml-1">${time}</span>
            </div>
        `;
    }
    return div;
}

function createSidebarItem(chat, isActive) {
    const div = document.createElement('div');
    
    // Formatting classes
    const activeClass = isActive ? "bg-green-50 border-l-4 border-green-500" : "hover:bg-gray-50 border-l-4 border-transparent";
    div.className = `flex gap-3 p-3 rounded-xl cursor-pointer transition ${activeClass}`;
    
    // Handle date formatting
    const date = new Date(chat.updated_at);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Handle last message preview
    let previewText = "Chưa có tin nhắn";
    if (chat.last_message) {
        const prefix = chat.last_message.is_sender ? "Bạn: " : "";
        previewText = prefix + chat.last_message.content;
    }

    // Handle Unread Status (Bold text if not seen)
    const seenClass = chat.is_seen ? "text-gray-500" : "text-dark-900 font-bold";
    const msgClass = chat.is_seen ? "text-gray-500" : "text-green-600 font-semibold";

    div.innerHTML = `
        <div class="relative shrink-0 w-12 h-12">
            <img src="${chat.partner.avatar_url || 'https://i.pravatar.cc/150'}" class="w-full h-full rounded-full object-cover border border-gray-200">
            </div>
        <div class="hidden md:flex flex-1 min-w-0 flex-col justify-center">
            <div class="flex justify-between items-center">
                <p class="${seenClass} text-sm truncate"> ${escapeHtml(chat.order_name || "Đơn hàng")} </p>
                <span class="text-[10px] text-gray-400 font-medium">${timeString}</span>
            </div>
            <p class="text-xs ${msgClass} truncate">${escapeHtml(previewText)}</p>
        </div>
    `;

    // Click event to switch chat
    div.addEventListener('click', () => {
        if (state.currentOrderId !== chat.order_id) {
            // End call if active when switching chats
            if (state.callState !== 'idle') {
                endCall(true);
            }

            // Update URL without reloading
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('orderId', chat.order_id);
            window.history.pushState({}, '', newUrl);
            
            // Update State
            state.currentOrderId = chat.order_id;
            state.nextCursor = null; // Reset pagination
            state.isLoadingHistory = false;
            
            // Reload UI
            loadSidebarConversations(); 
            loadChatHistory(null); 
            joinChatRoom(chat.order_id);
        }
    });

    return div;
}

function setupEventListeners() {
    // End call when leaving page or refreshing
    window.addEventListener('beforeunload', () => {
        if (state.callState !== 'idle') {
            endCall(true);
        }
    });

    // Send Button
    els.btnSend.addEventListener('click', sendMessage);

    // Enter Key
    els.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Typing Indicator Logic
    els.input.addEventListener('input', () => {
        socket.emit('start-typing', { target_order_id: state.currentOrderId });
        
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            socket.emit('stop-typing', { target_order_id: state.currentOrderId });
        }, 1000);
    });

    // Call UI Logic
    if (els.btnCall) {
        els.btnCall.addEventListener('click', initiateCall);
    }
    if (els.btnEndCall) {
        els.btnEndCall.addEventListener('click', () => endCall(true));
    }
    if (els.btnAcceptCall) {
        els.btnAcceptCall.addEventListener('click', acceptCall);
    }
    if (els.btnRejectCall) {
        els.btnRejectCall.addEventListener('click', rejectCall);
    }
    if (els.btnToggleMic) {
        els.btnToggleMic.addEventListener('click', toggleMic);
    }
    if (els.btnToggleCamera) {
        els.btnToggleCamera.addEventListener('click', toggleCamera);
    }

    els.msgContainer.addEventListener('scroll', () => {
        // If scrolled to top (scrollTop === 0) AND we have more data (nextCursor)
        if (els.msgContainer.scrollTop === 0 && state.nextCursor) {
            loadChatHistory(state.nextCursor);
        }
    });
}

function enableInput(enabled) {
    if (enabled) {
        els.input.disabled = false;
        els.input.focus();
        els.btnSend.classList.remove('bg-gray-300', 'pointer-events-none');
        els.btnSend.classList.add('bg-green-500');
    } else {
        els.input.disabled = true;
        els.btnSend.classList.add('bg-gray-300', 'pointer-events-none');
        els.btnSend.classList.remove('bg-green-500');
    }
}

function scrollToBottom() {
    els.msgContainer.scrollTop = els.msgContainer.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function updateBackButton() {
    const backButton = document.getElementById('backButton');
    if (backButton && state.currentOrderId) {
        backButton.href = `./customer/customer_activity.html?orderId=${state.currentOrderId}`;
    }
}

// VIDEO CALL FUNCTIONS

async function initiateCall() {
    if (!state.currentOrderId) {
        alert('Vui lòng chọn một cuộc trò chuyện trước');
        return;
    }

    try {
        // Request media permissions first
        state.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: "user",
            }
        });

        // Show local video preview
        els.localVideo.srcObject = state.localStream;

        state.callState = 'calling';

        playSound('ringtone');

        updateCallUI();
        showCallOverlay();

        // Emit call initiation
        socket.emit('call:initiate', { order_id: state.currentOrderId }, (ack) => {
            if (!ack.ok) {
                console.error('Failed to initiate call:', ack.error);
                endCall(false);
                alert('Không thể bắt đầu cuộc gọi: ' + ack.error);
            }
        });
    } catch (err) {
        console.error('Failed to get media devices:', err);
        alert('Không thể truy cập camera/microphone. Vui lòng cấp quyền.');
    }
}

function showCallOverlay() {
    // Update partner info on call overlay
    if (state.partnerAvatar) {
        els.callPartnerAvatar.src = state.partnerAvatar;
    }
    if (state.partnerName) {
        els.callPartnerName.innerText = state.partnerName;
    }
    els.callOverlay.classList.remove('hidden');
}

function showIncomingCall() {
    // Update incoming call UI with partner info
    playSound('ringtone');

    if (state.partnerAvatar) {
        els.incomingCallAvatar.src = state.partnerAvatar;
    }
    if (state.partnerName) {
        els.incomingCallName.innerText = state.partnerName;
    }
    els.incomingCallOverlay.classList.remove('hidden');
}

async function acceptCall() {
    try {
        stopSounds();

        // Get media stream
        state.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: "user"
            }
        });
        els.localVideo.srcObject = state.localStream;

        // Hide incoming call overlay, show main call overlay
        els.incomingCallOverlay.classList.add('hidden');
        state.callState = 'connected';
        state.currentOrderId = state.incomingCallOrderId;
        updateCallUI();
        showCallOverlay();

        // Accept the call via socket
        socket.emit('call:accept', { order_id: state.incomingCallOrderId }, (ack) => {
            if (!ack.ok) {
                console.error('Failed to accept call:', ack.error);
                endCall(false);
            }
        });
    } catch (err) {
        console.error('Failed to get media devices:', err);
        alert('Không thể truy cập camera/microphone');
        rejectCall();
    }
}

function rejectCall() {
    stopSounds();
    sounds.end.play().catch(e => {});
    socket.emit('call:reject', { order_id: state.incomingCallOrderId });
    els.incomingCallOverlay.classList.add('hidden');
    state.incomingCallOrderId = null;
}

function endCall(emitToServer = true) {
    // Emit end call to server
    stopSounds();
    if (state.callState !== 'idle') {
        sounds.end.play().catch(e => {});
    }
    if (emitToServer && state.currentOrderId) {
        socket.emit('call:end', { order_id: state.currentOrderId });
    }

    // Stop local stream
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }

    // Close peer connection
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }

    // Reset video elements
    els.localVideo.srcObject = null;
    els.remoteVideo.srcObject = null;

    // Reset call state
    state.callState = 'idle';
    state.remoteStream = null;
    state.isMuted = false;
    state.isCameraOff = false;

    if (state.callTimer) {
        clearInterval(state.callTimer);
        state.callTimer = null;
    }
    state.callSeconds = 0;

    els.callOverlay.classList.add('hidden');
    els.incomingCallOverlay.classList.add('hidden');
    els.videoContainer.classList.add('hidden');
    els.callingUI.classList.remove('hidden');
    els.callTimer.classList.add('hidden');

    updateToggleButtons();
}

function updateCallUI() {
    switch (state.callState) {
        case 'calling':
            els.callStatusLabel.innerText = 'Đang gọi...';
            els.callingUI.classList.remove('hidden');
            els.videoContainer.classList.add('hidden');
            els.callTimer.classList.add('hidden');
            break;
        case 'connected':
            els.callStatusLabel.innerText = 'Đã kết nối';
            break;
    }
}

function startCallTimer() {
    state.callSeconds = 0;
    els.callTimer.classList.remove('hidden');
    updateCallTimerDisplay();
    
    state.callTimer = setInterval(() => {
        state.callSeconds++;
        updateCallTimerDisplay();
    }, 1000);
}

function updateCallTimerDisplay() {
    const mins = Math.floor(state.callSeconds / 60).toString().padStart(2, '0');
    const secs = (state.callSeconds % 60).toString().padStart(2, '0');
    els.callTimer.innerText = `${mins}:${secs}`;
}

function toggleMic() {
    if (state.localStream) {
        const audioTrack = state.localStream.getAudioTracks()[0];
        if (audioTrack) {
            state.isMuted = !state.isMuted;
            audioTrack.enabled = !state.isMuted;
            updateToggleButtons();
        }
    }
}

function toggleCamera() {
    if (state.localStream) {
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
            state.isCameraOff = !state.isCameraOff;
            videoTrack.enabled = !state.isCameraOff;
            updateToggleButtons();
        }
    }
}

function updateToggleButtons() {
    // Update mic button
    const micIcon = els.btnToggleMic.querySelector('.material-symbols-outlined');
    if (state.isMuted) {
        micIcon.innerText = 'mic_off';
        els.btnToggleMic.classList.add('bg-red-500/50');
        els.btnToggleMic.classList.remove('bg-white/10');
    } else {
        micIcon.innerText = 'mic';
        els.btnToggleMic.classList.remove('bg-red-500/50');
        els.btnToggleMic.classList.add('bg-white/10');
    }

    // Update camera button
    const camIcon = els.btnToggleCamera.querySelector('.material-symbols-outlined');
    if (state.isCameraOff) {
        camIcon.innerText = 'videocam_off';
        els.btnToggleCamera.classList.add('bg-red-500/50');
        els.btnToggleCamera.classList.remove('bg-white/10');
    } else {
        camIcon.innerText = 'videocam';
        els.btnToggleCamera.classList.remove('bg-red-500/50');
        els.btnToggleCamera.classList.add('bg-white/10');
    }
}

// WebRTC FUNCTIONS 

function createPeerConnection() {
    state.peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks to connection
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => {
            state.peerConnection.addTrack(track, state.localStream);
        });
    }

    // Handle incoming tracks (remote video/audio)
    state.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
            els.remoteVideo.srcObject = event.streams[0];
            state.remoteStream = event.streams[0];
            
            // Show video container, hide calling UI
            els.videoContainer.classList.remove('hidden');
            els.callingUI.classList.add('hidden');
            startCallTimer();
        }
    };

    // Handle ICE candidates
    state.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('call:ice-candidate', {
                order_id: state.currentOrderId,
                candidate: event.candidate
            });
        }
    };

    // Handle connection state changes
    state.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', state.peerConnection.connectionState);
        if (state.peerConnection.connectionState === 'disconnected' || 
            state.peerConnection.connectionState === 'failed') {
            endCall(true);
        }
    };

    return state.peerConnection;
}

async function createAndSendOffer() {
    try {
        createPeerConnection();
        
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);

        socket.emit('call:offer', {
            order_id: state.currentOrderId,
            offer: offer
        }, (ack) => {
            if (!ack.ok) {
                console.error('Failed to send offer:', ack.error);
            }
        });
    } catch (err) {
        console.error('Error creating offer:', err);
        endCall(true);
    }
}

async function handleOffer(offer) {
    try {
        createPeerConnection();

        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);

        socket.emit('call:answer', {
            order_id: state.currentOrderId,
            answer: answer
        }, (ack) => {
            if (!ack.ok) {
                console.error('Failed to send answer:', ack.error);
            }
        });
    } catch (err) {
        console.error('Error handling offer:', err);
        endCall(true);
    }
}

async function handleAnswer(answer) {
    try {
        if (state.peerConnection) {
            await state.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    } catch (err) {
        console.error('Error handling answer:', err);
    }
}

async function handleIceCandidate(candidate) {
    try {
        if (state.peerConnection && candidate) {
            await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (err) {
        console.error('Error adding ICE candidate:', err);
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    init();
    updateBackButton();
});