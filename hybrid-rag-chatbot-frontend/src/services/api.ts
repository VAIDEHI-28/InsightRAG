// frontend/src/services/api.ts

const API_BASE_URL = 'http://localhost:8000/api';

// ==================== CHAT ENDPOINTS ====================

// Create new chat
export const createChat = async (
    chatId: string,
    title: string = 'New Chat',
    pinned: boolean = false
) => {
    const response = await fetch(`${API_BASE_URL}/chat/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: chatId,
            title: title,
            pinned: pinned,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to create chat');
    }

    return await response.json();
};

// Get all chats
export const getAllChats = async () => {
    const response = await fetch(`${API_BASE_URL}/chat/list`);

    if (!response.ok) {
        throw new Error('Failed to fetch chats');
    }

    return await response.json();
};

// Get specific chat
export const getChat = async (chatId: string) => {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}`);

    if (!response.ok) {
        throw new Error('Failed to fetch chat');
    }

    return await response.json();
};

// Update chat
export const updateChat = async (
    chatId: string,
    updates: { title?: string; pinned?: boolean }
) => {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw new Error('Failed to update chat');
    }

    return await response.json();
};

// Delete chat
export const deleteChat = async (chatId: string) => {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete chat');
    }

    return await response.json();
};

// Get all messages for a chat
export const getChatMessages = async (chatId: string) => {
    const response = await fetch(`${API_BASE_URL}/chat/${chatId}/messages`);

    if (!response.ok) {
        throw new Error('Failed to fetch messages');
    }

    return await response.json();
};

// Send message
export const sendMessage = async (chatId: string, message: string) => {
    const response = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message: message,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to send message');
    }

    return await response.json();
};

// Save message manually
export const saveMessage = async (
    messageId: string,
    chatId: string,
    type: 'user' | 'bot',
    content: string
) => {
    const response = await fetch(`${API_BASE_URL}/chat/message/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: messageId,
            chat_id: chatId,
            type: type,
            content: content,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to save message');
    }

    return await response.json();
};

// ==================== FILE ENDPOINTS ====================

// -------- LEGACY FILE SYSTEM (UNCHANGED) --------

// Upload file (legacy)
export const uploadFile = async (file: File, chatId?: string) => {
    const formData = new FormData();
    formData.append('file', file);

    const url = chatId
        ? `${API_BASE_URL}/files/upload?chat_id=${chatId}`
        : `${API_BASE_URL}/files/upload`;

    const response = await fetch(url, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Failed to upload file');
    }

    return await response.json();
};

// List legacy chat files
export const getChatFiles = async (chatId: string) => {
    const response = await fetch(`${API_BASE_URL}/files/list/${chatId}`);

    if (!response.ok) {
        throw new Error('Failed to fetch files');
    }

    return await response.json();
};

// Delete legacy file
export const deleteFile = async (fileId: string) => {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete file');
    }

    return await response.json();
};


// -------- NEW CHAT-ISOLATED CATEGORY SYSTEM --------

// Upload file with category + chat isolation
export const uploadFileWithCategory = async (
    file: File,
    chatId: string,
    category: 'purchase' | 'hr' | 'finance' | 'other',
    description?: string
) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('chat_id', chatId);   // 🔥 REQUIRED

    if (description) {
        formData.append('description', description);
    }

    const response = await fetch(`${API_BASE_URL}/files/upload-category`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload file');
    }

    return await response.json();
};


// Get files by chat + category (Option A)
export const getFilesByChatAndCategory = async (
    chatId: string,
    category: 'purchase' | 'hr' | 'finance' | 'other'
) => {
    const response = await fetch(
        `${API_BASE_URL}/files/list/${chatId}/${category}`
    );

    if (!response.ok) {
        throw new Error('Failed to fetch files');
    }

    return await response.json();
};


// Delete file (chat isolated)
export const deleteFileByCategory = async (
    chatId: string,
    fileId: string
) => {
    const response = await fetch(
        `${API_BASE_URL}/files/delete-category/${chatId}/${fileId}`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        throw new Error('Failed to delete file');
    }

    return await response.json();
};


// ==================== HEALTH CHECK ====================

export const healthCheck = async () => {
    const response = await fetch(`${API_BASE_URL}/health`);

    if (!response.ok) {
        throw new Error('Backend is not healthy');
    }

    return await response.json();
};