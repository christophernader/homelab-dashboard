/**
 * Dashboard Terminal Logic
 * Handles the WebSocket-based terminal with tabs.
 */

let terminalOpen = false;
let terminalTabs = new Map(); // tabId -> { term, fitAddon, ws, container }
let activeTabId = null;
let tabCounter = 0;

function toggleTerminal() {
    terminalOpen = !terminalOpen;
    const overlay = document.getElementById('terminal-overlay');

    if (terminalOpen) {
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => overlay.classList.remove('opacity-0'));

        // Create first tab if none exist
        if (terminalTabs.size === 0) {
            createTerminalTab();
        } else {
            // Focus active terminal
            const activeTab = terminalTabs.get(activeTabId);
            if (activeTab) {
                setTimeout(() => {
                    activeTab.fitAddon.fit();
                    activeTab.term.focus();
                }, 100);
            }
        }
    } else {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function createTerminalTab() {
    const tabId = `tab-${++tabCounter}`;
    const tabsContainer = document.getElementById('terminal-tabs');
    const panelsContainer = document.getElementById('terminal-panels');

    // Create tab button
    const tabBtn = document.createElement('button');
    tabBtn.id = `btn-${tabId}`;
    tabBtn.className = 'flex items-center gap-2 px-3 py-1 text-[10px] font-mono uppercase tracking-wider border border-mil-border bg-mil-card text-mil-muted hover:text-mil-text transition-all whitespace-nowrap';
    tabBtn.innerHTML = `
    <i class="fa-solid fa-terminal text-[8px]"></i>
    <span>TERM ${tabCounter}</span>
    <span onclick="event.stopPropagation(); closeTerminalTab('${tabId}')" class="ml-1 hover:text-mil-error">
      <i class="fa-solid fa-xmark text-[8px]"></i>
    </span>
  `;
    tabBtn.onclick = () => switchTerminalTab(tabId);
    tabsContainer.appendChild(tabBtn);

    // Create terminal container
    const termContainer = document.createElement('div');
    termContainer.id = `panel-${tabId}`;
    termContainer.className = 'absolute inset-0 p-2 pb-6 hidden';
    panelsContainer.appendChild(termContainer);

    // Initialize terminal
    const term = new Terminal({
        theme: {
            background: '#0a0a0a',
            foreground: '#e5e5e5',
            cursor: '#f97316',
            cursorAccent: '#0a0a0a',
            selectionBackground: '#f9731650',
            black: '#0a0a0a',
            red: '#ef4444',
            green: '#22c55e',
            yellow: '#f97316',
            blue: '#3b82f6',
            magenta: '#a855f7',
            cyan: '#06b6d4',
            white: '#e5e5e5',
        },
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 14,
        cursorBlink: true,
        cursorStyle: 'block',
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(termContainer);

    // Store tab data
    terminalTabs.set(tabId, { term, fitAddon, ws: null, container: termContainer, tabBtn });

    // Switch to new tab
    switchTerminalTab(tabId);

    // Connect to WebSocket
    connectTerminalWS(tabId);

    // Handle resize
    window.addEventListener('resize', () => {
        if (terminalOpen && activeTabId === tabId) {
            fitAddon.fit();
        }
    });
}

function switchTerminalTab(tabId) {
    // Hide all panels and deactivate all tabs
    terminalTabs.forEach((data, id) => {
        data.container.classList.add('hidden');
        data.tabBtn.classList.remove('border-mil-accent', 'text-mil-accent', 'bg-mil-dark');
        data.tabBtn.classList.add('border-mil-border', 'text-mil-muted', 'bg-mil-card');
    });

    // Show selected panel and activate tab
    const tab = terminalTabs.get(tabId);
    if (tab) {
        tab.container.classList.remove('hidden');
        tab.tabBtn.classList.remove('border-mil-border', 'text-mil-muted', 'bg-mil-card');
        tab.tabBtn.classList.add('border-mil-accent', 'text-mil-accent', 'bg-mil-dark');
        activeTabId = tabId;

        setTimeout(() => {
            tab.fitAddon.fit();
            tab.term.focus();
        }, 50);

        // Update status based on this tab's connection
        updateTerminalStatus(tab.ws);
    }
}

function closeTerminalTab(tabId) {
    const tab = terminalTabs.get(tabId);
    if (!tab) return;

    // Close WebSocket
    if (tab.ws) {
        tab.ws.close();
    }

    // Remove DOM elements
    tab.tabBtn.remove();
    tab.container.remove();
    tab.term.dispose();

    // Remove from map
    terminalTabs.delete(tabId);

    // Switch to another tab or close terminal if none left
    if (terminalTabs.size === 0) {
        toggleTerminal();
    } else {
        const nextTabId = terminalTabs.keys().next().value;
        switchTerminalTab(nextTabId);
    }
}

function updateTerminalStatus(ws) {
    const statusEl = document.getElementById('terminal-status');
    if (ws && ws.readyState === WebSocket.OPEN) {
        statusEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-mil-success animate-pulse"></span>
      CONNECTED
    `;
    } else {
        statusEl.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-mil-error"></span>
      DISCONNECTED
    `;
    }
}

function connectTerminalWS(tabId) {
    const tab = terminalTabs.get(tabId);
    if (!tab) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/terminal`;

    try {
        const ws = new WebSocket(wsUrl);
        tab.ws = ws;

        ws.onopen = () => {
            if (activeTabId === tabId) updateTerminalStatus(ws);
            // Send initial resize
            setTimeout(() => {
                tab.fitAddon.fit();
                const dims = tab.fitAddon.proposeDimensions();
                if (dims) {
                    ws.send(`\x1b[8;${dims.rows};${dims.cols}t`);
                }
            }, 100);
        };

        ws.onmessage = (event) => {
            tab.term.write(event.data);
        };

        ws.onclose = () => {
            if (activeTabId === tabId) updateTerminalStatus(ws);
            tab.term.write('\r\n\x1b[1;31m[DISCONNECTED]\x1b[0m Connection closed\r\n');
        };

        ws.onerror = () => {
            if (activeTabId === tabId) updateTerminalStatus(ws);
        };

        tab.term.onData((data) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        // Handle terminal resize
        tab.term.onResize(({ cols, rows }) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(`\x1b[8;${rows};${cols}t`);
            }
        });

    } catch (e) {
        console.error('WebSocket connection failed:', e);
        updateTerminalStatus(null);
    }
}
