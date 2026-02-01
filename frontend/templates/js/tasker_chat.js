// 1. CONFIGURATION & STATE
const API_BASE = window.API_BASE || (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL ? window.CONFIG.API_BASE_URL : "http://localhost:3000");
const API_URL = API_BASE + "/api";
const SOCKET_URL = API_BASE;

const state = {
    token: localStorage.getItem('token'),
    userId: localStorage.getItem('user_id'),
    currentOrderId: new URLSearchParams(window.location.search).get('orderId'),
    currentChatId: null,
    typingTimeout: null,
    nextCursor: null, 
    isLoadingHistory: false,
    partnerAvatar: null
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
    // Call UI
    btnCall: document.getElementById('btn-call'),
    btnEndCall: document.getElementById('btn-end-call'),
    callOverlay: document.getElementById('call-overlay')
};

// 2. SOCKET INITIALIZATION
let socket;

function initSocket() {
    if (!state.token) {
        alert("Vui lòng đăng nhập");
        window.location.href = '../auth/login-signup.html';
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

    // Event: Receive Message
    socket.on('receive-message', (payload) => {
        // Only append if it belongs to current chat
        if (payload.chat_id === state.currentChatId) {
            appendMessageToUI(payload);
            scrollToBottom();
            socket.emit('mark-read', { target_order_id: state.currentOrderId });
        }
    });

    // Event: Typing Indicators
    socket.on('start-typing', () => {
        els.typingIndicator.classList.remove('hidden');
    });

    socket.on('stop-typing', () => {
        els.typingIndicator.classList.add('hidden');
    });
}

// 3. MAIN LOGIC

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
        if (!response.ok) throw new Error(res.error || "Error loading chat");

        const messages = res.data || [];
        
        // Update cursor from backend response
        state.nextCursor = res.nextCursor; 

        if (!cursor) {
            // === INITIAL LOAD ===
            els.loadingHistory.classList.add('hidden');
            
            // Remove old messages (keeping the loader div intact)
            while (els.msgContainer.lastChild && els.msgContainer.lastChild.id !== 'loading-history') {
                els.msgContainer.removeChild(els.msgContainer.lastChild);
            }

            els.headerName.innerText = `Đơn hàng #${state.currentOrderId.slice(-6).toUpperCase()}`;
            
            if (res.conversation && res.conversation.partner) {
                const { full_name, avatar_url, average_rating } = res.conversation.partner;
                const orderInfo = res.order;

                state.partnerAvatar = avatar_url;

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
                
                if (average_rating !== undefined && average_rating !== null) {
                     els.headerScore.innerHTML = `
                        <span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[9px] font-bold flex items-center">
                            ${Number(average_rating).toFixed(1)} 
                            <span class="material-symbols-outlined text-[10px] ml-0.5">star</span>
                        </span>
                    `;
                } else {
                    els.headerScore.innerHTML = "Chưa có đánh giá";
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

            // Render messages (Oldest -> Newest)
            messages.forEach(msg => appendMessageToUI(msg));
            scrollToBottom();
        } else {
            // === PAGINATION LOAD (PREPEND) ===
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

        // Auto-load more if content is too short
        if (state.nextCursor && els.msgContainer.scrollHeight <= els.msgContainer.clientHeight) {
            console.log("Content too short to scroll. Auto-loading older messages...");
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

// Send Message
function sendMessage() {
    const content = els.input.value.trim();
    if (!content) return;

    // 1. Emit to Socket
    socket.emit('send-message', {
        target_order_id: state.currentOrderId,
        content: content
    }, (ack) => {
        if (!ack.ok) {
            alert("Gửi lỗi: " + ack.error);
        }
    });

    // 2. Clear Input
    els.input.value = '';
    socket.emit('stop-typing', { target_order_id: state.currentOrderId });
}

// UI: Append Message
function appendMessageToUI(msg) {
    const div = createMessageElement(msg);
    els.msgContainer.appendChild(div);
}

// 4. UTILS & EVENT LISTENERS

function prependMessagesToUI(messages) {
    // Backend returns [Oldest, ..., Newest] for the requested batch.
    // We want them to appear at the TOP of the current list.
    
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
                <p class="font-bold text-dark-900 text-sm truncate">${chat.partner.full_name}</p>
                <span class="text-[10px] text-gray-400 font-medium">${timeString}</span>
            </div>
            <p class="text-xs ${msgClass} truncate">${escapeHtml(previewText)}</p>
        </div>
    `;

    // Click event to switch chat
    div.addEventListener('click', () => {
        if (state.currentOrderId !== chat.order_id) {
            // Update URL without reloading
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('orderId', chat.order_id);
            window.history.pushState({}, '', newUrl);
            
            // Update State
            state.currentOrderId = chat.order_id;
            state.nextCursor = null; // Reset pagination
            state.isLoadingHistory = false;
            
            // Reload UI
            loadSidebarConversations(); // Re-render sidebar to update active state
            loadChatHistory(null); // Load new messages
            joinChatRoom(chat.order_id); // Join new socket room
            updateBackButton(); // Update back button
        }
    });

    return div;
}

function setupEventListeners() {
    // Send Button
    els.btnSend.addEventListener('click', sendMessage);

    // Enter Key
    els.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Typing Indicator Logic
    els.input.addEventListener('input', () => {
        if (!state.currentOrderId) return;
        socket.emit('start-typing', { target_order_id: state.currentOrderId });
        
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            socket.emit('stop-typing', { target_order_id: state.currentOrderId });
        }, 1000);
    });

    // Call UI Logic
    if(els.btnCall && els.callOverlay && els.btnEndCall) {
        els.btnCall.addEventListener('click', () => els.callOverlay.classList.remove('hidden'));
        els.btnEndCall.addEventListener('click', () => els.callOverlay.classList.add('hidden'));
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

// Update back button to include orderId
function updateBackButton() {
    const backButton = document.getElementById('backButton');
    if (backButton && state.currentOrderId) {
        backButton.href = `./tasker_order_progress.html?orderId=${state.currentOrderId}`;
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    init();
    updateBackButton();
});
