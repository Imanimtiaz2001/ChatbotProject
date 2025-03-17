document.addEventListener("DOMContentLoaded", function () {
  // =========== ICON DEFINITIONS ===========
  // Icon when sidebar is open (button shows a square icon inside a box with "Close sidebar" hint)
  const openIcon = `<svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <rect x="9" y="9" width="6" height="6"></rect>
    </svg>`;

  // Icon when sidebar is closed (button shows the current icon with "Open sidebar" hint)
  const closedIcon = `<svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
      <line x1="12" y1="4" x2="12" y2="20"></line>
    </svg>`;

  // =========== DOM ELEMENTS ===========
  // Sidebar toggle
  const toggleSidebarButton = document.getElementById("toggleSidebarButton");

  // Sidebar
  const newChatButton = document.getElementById("newChatButton");
  const chatModelSelect = document.getElementById("chatModel");
  const modelSelectLabel = document.getElementById("modelSelectLabel");
  const currentModelLabel = document.getElementById("currentModelLabel");
  const chatSessionsList = document.getElementById("chatSessionsList");

  // Main chat
  const chatBox = document.getElementById("chatBox");

  // Chat input bar
  const attachDocButton = document.getElementById("attachDocButton");
  const fileInput = document.getElementById("fileInput");
  const userQueryInput = document.getElementById("userQueryInput");
  const sendMessageButton = document.getElementById("sendMessageButton");

  // File preview chip (now inside the chat input bar)
  const selectedFilePreview = document.getElementById("selectedFilePreview");
  const selectedFileNameSpan = document.getElementById("selectedFileName");
  const filePreviewStatus = document.getElementById("filePreviewStatus");
  const removeFileButton = document.getElementById("removeFileButton");
  const fileIconContainer = document.getElementById("fileIconContainer");

  // =========== STATE ===========
  let currentChatId = null;    // Unique ID for the current chat
  let currentChatType = "pdf"; // "pdf" or "direct"
  let isFileUploading = false; // Track if a file is currently uploading

  // =========== LOCAL STORAGE HELPERS ===========
  function getSavedSessions() {
    const sessions = localStorage.getItem("chat_sessions");
    return sessions ? JSON.parse(sessions) : [];
  }

  function saveSessions(sessions) {
    localStorage.setItem("chat_sessions", JSON.stringify(sessions));
  }

  function getSessionById(chatId) {
    const sessions = getSavedSessions();
    return sessions.find((s) => s.chatId === chatId);
  }

  function saveSession(session) {
    let sessions = getSavedSessions();
    const idx = sessions.findIndex((s) => s.chatId === session.chatId);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.push(session);
    }
    saveSessions(sessions);
  }

  // =========== SIDEBAR TITLE HELPER ===========
  // We generate a short title from the first user message in that chat
  function getSessionTitle(session) {
    const userMsg = session.messages.find(
      (m) => m.sender === "user" && m.text.trim().length > 0
    );
    if (!userMsg) {
      return "New Chat";
    }
    const words = userMsg.text.split(/\s+/).slice(0, 3).join(" ");
    return words + "...";
  }

  // =========== SIDEBAR ===========
  function populateSidebar() {
    chatSessionsList.innerHTML = "";
    const sessions = getSavedSessions();

    sessions.forEach((session) => {
      const item = document.createElement("div");
      item.classList.add("chat-session-item");

      // Title text
      const sessionTitleSpan = document.createElement("span");
      sessionTitleSpan.textContent = getSessionTitle(session);

      // Delete bin icon/button
      const deleteBin = document.createElement("button");
      deleteBin.classList.add("delete-chat-btn");
      deleteBin.innerHTML = `
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6
                   m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
        </svg>
      `;

      // Confirm delete on click
      deleteBin.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent loading the chat
        const confirmDel = confirm("Are you sure you want to delete this chat?");
        if (confirmDel) {
          // Filter out this session from localStorage
          let updatedSessions = getSavedSessions().filter(s => s.chatId !== session.chatId);
          saveSessions(updatedSessions);

          // If the deleted chat was active, reset current chat
          if (currentChatId === session.chatId) {
            currentChatId = null;
            chatBox.innerHTML = "";
          }

          // Re-populate sidebar
          populateSidebar();
        }
      });

      // Load chat on click of the item
      item.addEventListener("click", () => loadChatSession(session.chatId));

      // Highlight if it's the active chat
      if (session.chatId === currentChatId) {
        item.classList.add("active");
      }

      // Append elements
      item.appendChild(sessionTitleSpan);
      item.appendChild(deleteBin);
      chatSessionsList.appendChild(item);
    });
  }

  function loadChatSession(chatId) {
    const session = getSessionById(chatId);
    if (!session) return;

    currentChatId = session.chatId;
    currentChatType = session.type;

    // Clear the chat box
    chatBox.innerHTML = "";

    // Render existing messages
    session.messages.forEach((msg) => {
      renderMessage(msg.text, msg.sender);
    });

    // Update the UI for the current model (dropdown or label)
    updateModelUIForSession(session);

    // Re-populate sidebar to highlight active chat
    populateSidebar();

    // Hide any leftover file preview
    hideFilePreview();
  }

  // =========== SHOW/HIDE MODEL UI BASED ON MESSAGES ===========
  function updateModelUIForSession(session) {
    const hasMessages = session.messages.length > 0;
    // If chat has messages, show the label (model locked)
    if (hasMessages) {
      modelSelectLabel.classList.add("hidden");
      chatModelSelect.classList.add("hidden");
      currentModelLabel.classList.remove("hidden");

      // Display the model
      if (session.type === "pdf") {
        currentModelLabel.textContent = "Model: PDFChat";
        attachDocButton.style.display = "inline-block";
      } else {
        currentModelLabel.textContent = "Model: DirectChat";
        attachDocButton.style.display = "none";
      }
    } else {
      // If no messages, show the dropdown
      modelSelectLabel.classList.remove("hidden");
      chatModelSelect.classList.remove("hidden");
      currentModelLabel.classList.add("hidden");

      // Ensure the dropdown reflects the session type
      chatModelSelect.value = session.type;

      // Show/hide the pin button based on model
      if (session.type === "pdf") {
        attachDocButton.style.display = "inline-block";
      } else {
        attachDocButton.style.display = "none";
      }
    }
  }

  // =========== CREATE NEW CHAT ===========
  function startNewChat() {
    const newId = Date.now().toString();
    currentChatId = newId;
    currentChatType = chatModelSelect.value; // Use the currently selected model

    const newSession = {
      chatId: currentChatId,
      type: currentChatType,
      uploadedFileName: null,
      hasUploadedFile: false,
      docUsed: false,
      messages: [],
    };
    saveSession(newSession);

    // Now load this new chat session
    loadChatSession(currentChatId);
  }

  // =========== CHAT RENDERING ===========
  function renderMessage(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");

    if (sender === "user") {
      msgDiv.classList.add("user-message");
    } else if (sender === "ai") {
      msgDiv.classList.add("ai-message");
    } else if (sender === "document") {
      // PDF doc bubble
      msgDiv.classList.add("document-message", "file-message");
      const iconDiv = document.createElement("div");
      iconDiv.classList.add("file-icon");
      iconDiv.innerHTML = `
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      `;
      const fileSpan = document.createElement("span");
      fileSpan.textContent = text;
      msgDiv.appendChild(iconDiv);
      msgDiv.appendChild(fileSpan);
      chatBox.appendChild(msgDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
      return;
    }

    // For user/ai
    msgDiv.textContent = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // =========== FILE PREVIEW LOGIC ===========
  function showFilePreview(fileName) {
    selectedFilePreview.classList.remove("hidden");
    selectedFileNameSpan.textContent = fileName;
    filePreviewStatus.innerHTML = "";

    // Spinner while uploading
    fileIconContainer.innerHTML = `<span class="spinner"></span>`;

    startFileUpload(fileName);
  }

  function hideFilePreview() {
    selectedFilePreview.classList.add("hidden");
    selectedFileNameSpan.textContent = "";
    filePreviewStatus.innerHTML = "";
    fileIconContainer.innerHTML = "";
    fileInput.value = "";
  }

  async function startFileUpload(fileName) {
    if (!currentChatId) {
      startNewChat();
    }
    let session = getSessionById(currentChatId);
    if (!session) return;

    if (currentChatType !== "pdf") {
      return;
    }

    isFileUploading = true;
    sendMessageButton.disabled = true;

    const file = fileInput.files[0];
    if (!file) {
      hideFilePreview();
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/upload?chat_id=${currentChatId}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.message) {
        // Replace spinner with doc icon
        fileIconContainer.innerHTML = `
          <svg
            class="pdf-icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        `;
        session.uploadedFileName = fileName;
        session.hasUploadedFile = true;
        session.docUsed = false;
        saveSession(session);
      } else {
        filePreviewStatus.textContent = "Error uploading PDF";
      }
    } catch (err) {
      console.error(err);
      filePreviewStatus.textContent = "Error uploading PDF";
    }

    isFileUploading = false;
    sendMessageButton.disabled = false;
  }

  // =========== EVENT LISTENERS ===========
  // Toggle sidebar with dynamic icon & tooltip
  toggleSidebarButton.addEventListener("click", function() {
    document.body.classList.toggle("sidebar-collapsed");
    if (document.body.classList.contains("sidebar-collapsed")) {
      toggleSidebarButton.innerHTML = closedIcon;
      toggleSidebarButton.title = "Open sidebar";
    } else {
      toggleSidebarButton.innerHTML = openIcon;
      toggleSidebarButton.title = "Close sidebar";
    }
  });

  // New Chat
  newChatButton.addEventListener("click", startNewChat);

  // Model selection
  chatModelSelect.addEventListener("change", function () {
    currentChatType = this.value;
  });

  // Populate sidebar on load
  populateSidebar();

  // If there's at least one session, load the most recent
  const allSessions = getSavedSessions();
  if (allSessions.length > 0) {
    const lastSession = allSessions[allSessions.length - 1];
    currentChatId = lastSession.chatId;
    currentChatType = lastSession.type;
    loadChatSession(currentChatId);
  }

  // Pin icon
  attachDocButton.addEventListener("click", function () {
    fileInput.click(); // If direct mode, it's hidden anyway
  });

  // File input
  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) {
      showFilePreview(fileInput.files[0].name);
    } else {
      hideFilePreview();
    }
  });

  // Remove file
  removeFileButton.addEventListener("click", function () {
    hideFilePreview();
  });

  // Send message
  sendMessageButton.addEventListener("click", sendUserMessage);
  userQueryInput.addEventListener("keyup", function (e) {
    if (e.key === "Enter") {
      sendUserMessage();
    }
  });

  async function sendUserMessage() {
    const query = userQueryInput.value.trim();

    if (!currentChatId) {
      startNewChat();
    }
    let session = getSessionById(currentChatId);
    if (!session) return;

    // If PDF mode but no file is uploaded
    if (currentChatType === "pdf" && !session.hasUploadedFile && query) {
      alert("Please upload a PDF first!");
      return;
    }

    if (isFileUploading) {
      alert("File is still uploading. Please wait...");
      return;
    }

    // Show doc bubble once
    if (
      currentChatType === "pdf" &&
      session.hasUploadedFile &&
      session.uploadedFileName &&
      session.docUsed === false
    ) {
      renderMessage(session.uploadedFileName, "document");
      session.messages.push({ sender: "document", text: session.uploadedFileName });
      session.docUsed = true;
      saveSession(session);
    }

    // If user typed text
    if (query) {
      renderMessage(query, "user");
      session.messages.push({ sender: "user", text: query });
      saveSession(session);

      // Now the chat definitely has messages, so lock the model UI
      updateModelUIForSession(session);

      try {
        let endpoint = "/chatbot";
        if (currentChatType === "pdf") {
          endpoint = "/chat";
        }
        const res = await fetch(`${endpoint}?chat_id=${currentChatId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        if (data.response) {
          renderMessage(data.response, "ai");
          session.messages.push({ sender: "ai", text: data.response });
          saveSession(session);
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Clear user input
    userQueryInput.value = "";
    // Hide file preview
    hideFilePreview();
  }
});
