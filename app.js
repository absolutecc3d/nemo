
const MODELS = [
    {
        id: "nemo-flash",
        name: "Nemo Flash",
        description: "Fast and responsive"
    },
    {
        id: "nemo-core",
        name: "Nemo Core",
        description: "Balanced everyday assistant"
    },
    {
        id: "nemo-deep",
        name: "Nemo Deep",
        description: "Detailed, thoughtful answers"
    }
];

const STORAGE_KEY = "nemo-chats-v1";

let chats = loadChats();
let currentChatId = null;
let selectedModel = localStorage.getItem("nemo-model") || "nemo-core";
let isGenerating = false;
let abortController = null;

const $ = id => document.getElementById(id);

const ui = {
    sidebar: $("sidebar"),
    sidebarToggle: $("sidebarToggle"),
    mobileMenu: $("mobileMenu"),
    mobileClose: $("mobileClose"),
    scrim: $("scrim"),
    home: $("home"),

    chatList: $("chatList"),
    newChat: $("newChat"),

    modelPicker: $("modelPicker"),
    modelName: $("modelName"),
    modelMenu: $("modelMenu"),
    modelOptions: $("modelOptions"),

    promptInput: $("promptInput"),
    sendButton: $("sendButton"),

    welcome: $("welcome"),
    messages: $("messages"),
    conversation: $("conversation"),

    scrollBottom: $("scrollBottom"),

    errorToast: $("errorToast"),
    errorText: $("errorText"),
    dismissError: $("dismissError")
};

function loadChats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveChats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getChat() {
    return chats.find(chat => chat.id === currentChatId);
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatMessage(value) {
    let text = escapeHTML(value);

    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, language, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

    return text
        .split(/\n{2,}/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function renderModels() {
    const activeModel = MODELS.find(model => model.id === selectedModel) || MODELS[1];

    selectedModel = activeModel.id;
    ui.modelName.textContent = activeModel.name;

    ui.modelOptions.innerHTML = MODELS.map(model => `
        <button
            class="model-option ${model.id === selectedModel ? "selected" : ""}"
            data-model="${model.id}"
            type="button"
        >
            <span class="model-option-text">
                <span class="model-option-name">${model.name}</span>
                <span class="model-option-description">${model.description}</span>
            </span>
            ${model.id === selectedModel ? '<span class="model-option-check">✓</span>' : ""}
        </button>
    `).join("");

    ui.modelOptions.querySelectorAll("[data-model]").forEach(button => {
        button.addEventListener("click", () => {
            selectedModel = button.dataset.model;
            localStorage.setItem("nemo-model", selectedModel);
            renderModels();
            closeModelMenu();
        });
    });
}

function openModelMenu() {
    ui.modelMenu.hidden = false;
    ui.modelPicker.classList.add("picker-open");
    ui.modelPicker.setAttribute("aria-expanded", "true");
}

function closeModelMenu() {
    ui.modelMenu.hidden = true;
    ui.modelPicker.classList.remove("picker-open");
    ui.modelPicker.setAttribute("aria-expanded", "false");
}

function toggleModelMenu() {
    if (ui.modelMenu.hidden) {
        openModelMenu();
    } else {
        closeModelMenu();
    }
}

function showError(message) {
    ui.errorText.textContent = message;
    ui.errorToast.hidden = false;
}

function hideError() {
    ui.errorToast.hidden = true;
}

function createChat() {
    const chat = {
        id: makeId(),
        title: "New chat",
        messages: [],
        updatedAt: Date.now()
    };

    chats.push(chat);
    currentChatId = chat.id;

    saveChats();
    renderHistory();
    showWelcome();

    ui.promptInput.focus();
    closeSidebar();
}

function deleteChat(id) {
    chats = chats.filter(chat => chat.id !== id);

    if (currentChatId === id) {
        currentChatId = null;
    }

    saveChats();
    renderHistory();

    if (currentChatId) {
        renderMessages();
    } else {
        showWelcome();
    }
}

function openChat(id) {
    const chat = chats.find(item => item.id === id);
    if (!chat) return;

    currentChatId = id;

    renderHistory();
    renderMessages();
    closeSidebar();
}

function renderHistory() {
    if (!chats.length) {
        ui.chatList.innerHTML = "";
        return;
    }

    const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

    ui.chatList.innerHTML = sorted.map(chat => `
        <div class="history-row ${chat.id === currentChatId ? "active" : ""}">
            <button class="history-item" data-open-chat="${chat.id}" type="button">
                <span>${escapeHTML(chat.title || "New chat")}</span>
            </button>
            <button
                class="history-delete"
                data-delete-chat="${chat.id}"
                type="button"
                aria-label="Delete conversation"
            >×</button>
        </div>
    `).join("");

    ui.chatList.querySelectorAll("[data-open-chat]").forEach(button => {
        button.addEventListener("click", () => openChat(button.dataset.openChat));
    });

    ui.chatList.querySelectorAll("[data-delete-chat]").forEach(button => {
        button.addEventListener("click", () => deleteChat(button.dataset.deleteChat));
    });
}

function showWelcome() {
    ui.welcome.hidden = false;
    ui.messages.hidden = true;
    ui.messages.innerHTML = "";
    ui.scrollBottom.classList.remove("visible");
}

function showMessages() {
    ui.welcome.hidden = true;
    ui.messages.hidden = false;
}

function renderMessages() {
    const chat = getChat();

    if (!chat || !chat.messages.length) {
        showWelcome();
        return;
    }

    showMessages();

    ui.messages.innerHTML = chat.messages.map((message, index) => {
        if (message.role === "user") {
            return `
                <div class="message-row user">
                    <div class="message-content-wrap">
                        <div class="message-bubble user">
                            <div class="message-text">${formatMessage(message.content)}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="message-row assistant">
                <div class="assistant-avatar"><span>n</span></div>
                <div class="message-content-wrap">
                    <div class="message-author">Nemo</div>
                    <div class="message-bubble assistant">
                        <div class="message-text">${formatMessage(message.content)}</div>
                    </div>
                    <div class="message-actions">
                        <button type="button" data-copy-message="${index}">Copy</button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    ui.messages.querySelectorAll("[data-copy-message]").forEach(button => {
        button.addEventListener("click", async () => {
            const message = chat.messages[Number(button.dataset.copyMessage)];
            if (!message) return;

            try {
                await navigator.clipboard.writeText(message.content);
                button.textContent = "Copied";
                setTimeout(() => button.textContent = "Copy", 1500);
            } catch {
                button.textContent = "Copy failed";
            }
        });
    });

    scrollToBottom();
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        ui.conversation.scrollTop = ui.conversation.scrollHeight;
    });
}

function updateSendButton() {
    ui.sendButton.disabled = !ui.promptInput.value.trim() || isGenerating;
}

function updateStreamingMessage() {
    const chat = getChat();
    if (!chat) return;

    const lastMessage = chat.messages[chat.messages.length - 1];
    const assistantRows = ui.messages.querySelectorAll(".message-row.assistant");
    const lastRow = assistantRows[assistantRows.length - 1];

    if (!lastRow) return;

    const textContainer = lastRow.querySelector(".message-text");

    if (textContainer) {
        textContainer.innerHTML = formatMessage(lastMessage.content);
    }

    scrollToBottom();
}

async function sendMessage() {
    const content = ui.promptInput.value.trim();

    if (!content || isGenerating) return;

    hideError();

    if (!currentChatId) {
        createChat();
    }

    const chat = getChat();
    if (!chat) return;

    chat.messages.push({
        role: "user",
        content
    });

    if (chat.messages.length === 1) {
        chat.title = content.length > 38
            ? content.slice(0, 38) + "…"
            : content;
    }

    chat.updatedAt = Date.now();

    ui.promptInput.value = "";
    ui.promptInput.style.height = "auto";

    chat.messages.push({
        role: "assistant",
        content: ""
    });

    isGenerating = true;
    updateSendButton();

    renderHistory();
    renderMessages();

    abortController = new AbortController();

    try {
        const previousMessages = chat.messages.slice(0, -2);

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: previousMessages,
                currentMessage: content,
                model: selectedModel
            }),
            signal: abortController.signal
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || `Server error: ${response.status}`);
        }

        if (!response.body) {
            throw new Error("Streaming is not supported by this browser.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (!line.trim()) continue;

                let data;

                try {
                    data = JSON.parse(line);
                } catch {
                    continue;
                }

                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.message?.content) {
                    chat.messages[chat.messages.length - 1].content += data.message.content;
                    updateStreamingMessage();
                }
            }
        }

        if (buffer.trim()) {
            try {
                const data = JSON.parse(buffer);

                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.message?.content) {
                    chat.messages[chat.messages.length - 1].content += data.message.content;
                }
            } catch (error) {
                if (!(error instanceof SyntaxError)) throw error;
            }
        }

        if (!chat.messages[chat.messages.length - 1].content.trim()) {
            chat.messages[chat.messages.length - 1].content =
                "I couldn't generate a response. Please try again.";
        }

    } catch (error) {
        if (error.name === "AbortError") {
            const lastMessage = chat.messages[chat.messages.length - 1];

            if (!lastMessage.content.trim()) {
                chat.messages.pop();
            }
        } else {
            console.error("Nemo error:", error);
            chat.messages[chat.messages.length - 1].content =
                "Sorry, something went wrong. " + error.message;
        }
    } finally {
        isGenerating = false;
        abortController = null;

        chat.updatedAt = Date.now();

        saveChats();
        renderHistory();
        renderMessages();
        updateSendButton();
    }
}

function closeSidebar() {
    ui.sidebar.classList.remove("mobile-open");
    ui.scrim.hidden = true;
}

function openSidebar() {
    ui.sidebar.classList.add("mobile-open");
    ui.scrim.hidden = false;
}

function toggleSidebar() {
    if (window.innerWidth <= 650) {
        if (ui.sidebar.classList.contains("mobile-open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
        return;
    }

    ui.sidebar.classList.toggle("sidebar-collapsed");
    ui.sidebar.classList.toggle("sidebar-expanded");
}

function setupEvents() {
    ui.modelPicker.addEventListener("click", event => {
        event.stopPropagation();
        toggleModelMenu();
    });

    document.addEventListener("click", event => {
        if (
            !ui.modelMenu.contains(event.target) &&
            !ui.modelPicker.contains(event.target)
        ) {
            closeModelMenu();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeModelMenu();
            closeSidebar();
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            createChat();
        }

        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            document.activeElement === ui.promptInput
        ) {
            event.preventDefault();
            sendMessage();
        }
    });

    ui.promptInput.addEventListener("input", () => {
        ui.promptInput.style.height = "auto";
        ui.promptInput.style.height =
            Math.min(ui.promptInput.scrollHeight, 180) + "px";

        updateSendButton();
    });

    ui.sendButton.addEventListener("click", sendMessage);

    ui.newChat.addEventListener("click", createChat);

    ui.home.addEventListener("click", () => {
        currentChatId = null;
        renderHistory();
        showWelcome();
    });

    ui.sidebarToggle.addEventListener("click", toggleSidebar);
    ui.mobileMenu.addEventListener("click", openSidebar);
    ui.mobileClose.addEventListener("click", closeSidebar);
    ui.scrim.addEventListener("click", closeSidebar);

    ui.dismissError.addEventListener("click", hideError);

    document.querySelectorAll("[data-prompt]").forEach(button => {
        button.addEventListener("click", () => {
            ui.promptInput.value = button.dataset.prompt;
            updateSendButton();
            sendMessage();
        });
    });

    ui.conversation.addEventListener("scroll", () => {
        const distanceFromBottom =
            ui.conversation.scrollHeight -
            ui.conversation.scrollTop -
            ui.conversation.clientHeight;

        ui.scrollBottom.classList.toggle("visible", distanceFromBottom > 250);
    });

    ui.scrollBottom.addEventListener("click", scrollToBottom);
}

function init() {
    if (!MODELS.some(model => model.id === selectedModel)) {
        selectedModel = "nemo-core";
    }

    renderModels();
    renderHistory();
    setupEvents();

    ui.scrim.hidden = true;

    if (chats.length) {
        const latest = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        openChat(latest.id);
    } else {
        showWelcome();
    }

    updateSendButton();
}

init();
