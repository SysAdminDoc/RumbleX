// This is the content for res-styles.js

function defineStyles(core) {
    /* globals GM_addStyle */

    function injectPanelStyles() {
        GM_addStyle(`
:root { --res-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"; }
html { --res-bg-primary: #181a1b; --res-bg-secondary: #25282a; --res-bg-tertiary: #34383b; --res-bg-hover: #3d4245; --res-text-primary: #e8e6e3; --res-text-secondary: #b3b0aa; --res-border-color: #454a4d; --res-accent: #5a93ff; --res-accent-hover: #7eb0ff; --res-accent-glow: rgba(90, 147, 255, 0.3); --res-success: #22c55e; --res-error: #ef4444; --res-error-hover: #ff5252; --res-header-icon-color: #e8e6e3; --res-header-icon-hover-bg: #31363f; }

/* === SITE FIXES & ENHANCEMENTS === */
html.main-menu-mode-permanent { margin-top: -70px !important; }
div.border-0.border-b.border-solid.border-background-highlight,
div.hover-menu.main-menu-nav {
  border-style: none !important;
}

/* === Global Controls === */
#res-settings-button { background: transparent; border: none; cursor: pointer; padding: 6px; margin: 0 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s ease, transform 0.2s ease; }
#res-settings-button:hover { background-color: var(--res-header-icon-hover-bg); transform: scale(1.1) rotate(15deg); }
#res-settings-button svg { width: 26px; height: 26px; color: var(--res-header-icon-color); }
.header-user-actions, div[data-js="media_channel_container"] { display: flex; align-items: center; gap: 8px; }

/* === Settings Panel: Overlay & Container === */
#res-panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); z-index: 9998; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
#res-settings-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95); z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease, transform 0.3s ease; display: flex; flex-direction: column; width: 95%; max-width: 1024px; max-height: 90vh; background: var(--res-bg-primary); color: var(--res-text-primary); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); font-family: var(--res-font); border-radius: 16px; border: 1px solid var(--res-border-color); overflow: hidden; }
body.res-panel-open #res-panel-overlay { opacity: 1; pointer-events: auto; }
body.res-panel-open #res-settings-panel { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }

/* === Settings Panel: Header, Body, Footer === */
.res-settings-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 12px 24px; border-bottom: 1px solid var(--res-border-color); flex-shrink: 0; }
.res-header-title { display: flex; align-items: center; gap: 14px; }
.res-header-title img { width: 32px; height: 32px; }
.res-header-title h2 { font-size: 22px; font-weight: 700; margin: 0; }
.res-header-brand { background: linear-gradient(45deg, #8effa1, #5a93ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: brightness(1.1); }
.res-header-button { background: none; border: none; cursor: pointer; padding: 8px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s ease, transform 0.2s ease; }
.res-header-button:hover { background: var(--res-bg-secondary); transform: scale(1.1); }
.res-header-button svg { width: 20px; height: 20px; color: var(--res-text-secondary); }
.res-settings-body { display: flex; flex-grow: 1; overflow: hidden; }
.res-settings-tabs { display: flex; flex-direction: column; gap: 4px; padding: 24px 16px; border-right: 1px solid var(--res-border-color); flex-shrink: 0; overflow-y: auto; width: 220px; }
.res-tab-btn { background: none; border: none; color: var(--res-text-secondary); font-family: var(--res-font); font-size: 15px; text-align: left; padding: 10px 16px; cursor: pointer; transition: all 0.2s; font-weight: 500; border-radius: 8px; border-left: 3px solid transparent; width: 100%; }
.res-tab-btn:hover { background-color: var(--res-bg-secondary); color: var(--res-text-primary); }
.res-tab-btn.active { color: var(--res-accent); border-left-color: var(--res-accent); font-weight: 600; background-color: var(--res-bg-secondary); }
.res-settings-content { flex-grow: 1; overflow-y: auto; padding: 24px; }
.res-settings-pane { display: none; }
.res-settings-pane.active { display: grid; gap: 16px; animation: res-fade-in 0.4s ease-out; }
@keyframes res-fade-in { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
.res-pane-subheader { font-size: 14px; font-weight: 600; color: var(--res-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px; border-bottom: 1px solid var(--res-border-color); margin: 16px 0 -8px 0; grid-column: 1 / -1; }
.res-pane-subheader:first-of-type { margin-top: -8px; }
.res-settings-footer { padding: 12px 24px; border-top: 1px solid var(--res-border-color); flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; background: var(--res-bg-secondary); }
.res-footer-left { display: flex; align-items: center; gap: 16px; }
.res-github-link { color: var(--res-text-secondary); display: flex; align-items: center; transition: color .2s; }
.res-github-link:hover { color: var(--res-text-primary); }
.res-github-link svg { width: 22px; height: 22px; }
.res-footer-right { display: flex; align-items: center; gap: 16px; }
.res-version { font-size: 12px; color: var(--res-text-secondary); cursor: help; }

/* === Settings Panel: Setting Rows & Toggles === */
.res-setting-row, .res-management-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 16px; background: var(--res-bg-secondary); border: 1px solid var(--res-border-color); border-radius: 12px; transition: box-shadow .2s; }
.res-setting-row:hover, .res-management-row:hover { box-shadow: 0 0 15px rgba(0,0,0,0.1); }
.res-toggle-all-row { background: var(--res-bg-primary); border-style: dashed; }
.res-setting-row-text { display: flex; flex-direction: column; gap: 4px; }
.res-setting-row label[for], .res-management-row label { font-size: 16px; font-weight: 500; cursor: pointer; color: var(--res-text-primary); }
.res-setting-row small, .res-management-row small { color: var(--res-text-secondary); font-size: 13px; line-height: 1.4; }
.res-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;}
.res-switch.disabled { opacity: 0.5; cursor: not-allowed; }
.res-switch input { opacity: 0; width: 0; height: 0; }
.res-slider { position: absolute; cursor: pointer; inset: 0; background-color: var(--res-bg-tertiary); transition: .4s; border-radius: 34px; }
.res-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
.res-switch input:checked + .res-slider { background-color: var(--res-accent); box-shadow: 0 0 10px var(--res-accent-glow); }
.res-switch input:checked + .res-slider:before { transform: translateX(20px); }
.res-switch.small { width: 38px; height: 20px; }
.res-switch.small .res-slider:before { height: 14px; width: 14px; }
.res-switch.small input:checked + .res-slider:before { transform: translateX(18px); }

/* === Buttons & Inputs === */
.res-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 14px; font-size: 14px; font-weight: 500; border-radius: 8px; border: 1px solid var(--res-border-color); cursor: pointer; transition: all .2s; background-color: var(--res-bg-tertiary); color: var(--res-text-primary); }
.res-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.res-button-primary { background-color: var(--res-accent); border-color: var(--res-accent); color: white; }
.res-button-primary:hover:not(:disabled) { background-color: var(--res-accent-hover); border-color: var(--res-accent-hover); }
.res-button-danger { background-color: var(--res-error); border-color: var(--res-error); color: white; }
.res-button-danger:hover:not(:disabled) { background-color: var(--res-error-hover); border-color: var(--res-error-hover); }
.res-icon-button { padding: 6px; }
.res-icon-button svg, .res-button svg { width: 16px; height: 16px; }
.res-button-group { display: flex; gap: 8px; }
.res-button.res-radio-button { padding: 8px 12px; }
.res-button.res-radio-button input { display: none; }
.res-button.res-radio-button:has(input:checked) { background-color: var(--res-accent); color: white; border-color: var(--res-accent); }
.res-input { background: var(--res-bg-primary); color: var(--res-text-primary); border: 1px solid var(--res-border-color); border-radius: 6px; padding: 8px 10px; font-family: var(--res-font); font-size: 14px; width: 100%; transition: border-color .2s, box-shadow .2s; }
.res-input:focus { outline: none; border-color: var(--res-accent); box-shadow: 0 0 0 3px var(--res-accent-glow); }
.res-input:disabled { background-color: var(--res-bg-tertiary); opacity: 0.7; cursor: not-allowed; }
.res-list-empty { color: var(--res-text-secondary); text-align: center; padding: 24px; font-style: italic; }

/* === Management Panes (Comments, Nav) === */
.res-management-row { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none; }
.res-blocked-users-container { background: var(--res-bg-secondary); border: 1px solid var(--res-border-color); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.res-blocked-users-list-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--res-border-color); }
.res-blocked-users-list-header h3 { font-size: 16px; font-weight: 600; margin: 0; flex-shrink: 0; }
.res-blocked-users-list-header .res-button-group { margin-left: auto; }
.res-blocked-users-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 8px; }
.res-blocked-user-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; border-bottom: 1px solid var(--res-border-color); }
.res-blocked-user-item:last-child { border-bottom: none; }
.res-blocked-user-item span { font-weight: 500; }
.res-unblock-btn { padding: 4px 10px; font-size: 13px; }

/* === Toast & Spinners === */
@keyframes res-spin { to { transform: rotate(360deg); } }
.res-spinner-svg { animation: res-spin 1.2s cubic-bezier(0.5, 0.15, 0.5, 0.85) infinite; }
.res-toast { position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%); color: white; padding: 12px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: var(--res-font); font-size: 15px; font-weight: 500; z-index: 10002; transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55); border-radius: 8px; }
.res-toast.show { bottom: 20px; }
.res-toast.success { background-color: var(--res-success); }
.res-toast.error { background-color: var(--res-error); }

/* === Blocker UI === */
.comments-meta { position: relative; }
.res-block-user-btn { position: absolute; right: 0; top: 50%; transform: translateY(-50%); background-color: var(--res-error); color: white; border: none; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 600; cursor: pointer; opacity: 0; transition: opacity .2s, background-color .2s; }
.comment-item:hover .res-block-user-btn { opacity: 1; }
.res-block-user-btn:hover { background-color: var(--res-error-hover); }
.res-live-chat-block-btn { background: none; border: none; cursor: pointer; opacity: 0; transition: opacity .2s; padding: 2px 4px; margin-left: auto; }
.chat-history--row:hover .res-live-chat-block-btn { opacity: 0.4; }
.res-live-chat-block-btn:hover { opacity: 1; color: var(--res-error); }
.res-live-chat-block-btn svg { width: 14px; height: 14px; color: var(--res-text-secondary); }
.res-live-chat-block-btn:hover svg { color: var(--res-error); }

/* === RUD Downloader Integration & Overrides === */
#rud-comments-spacer { height: 0 !important; }
#rud-portal .rud-theme-toggle { display: none !important; }
#rud-download-btn {
    height: 36px;
    padding: 0.5rem 0.9rem;
    border-radius: 18px;
    font-size: 13px;
}
.rud-panel {
    border-radius: 16px;
    width: 600px;
}
.rud-body {
    padding: 0;
}
.rud-list {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.rud-group-box {
    background-color: var(--res-bg-secondary);
    border: 1px solid var(--res-border-color);
    border-radius: 12px;
    padding: 12px;
}
.rud-group-box-header {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--res-border-color);
    color: var(--res-text-primary);
}
.rud-group-box .rud-item {
    padding: 8px;
    margin: 0 !important;
}
.rud-item + .rud-item {
    margin-top: 2px !important;
}
.rud-item.rud-hide {
    display: none !important;
}
.rud-footer {
    padding: 12px 16px;
    background: transparent;
    border-top: none;
}
.rud-tar-note {
    font-size: 13px;
    padding: 10px;
    background-color: var(--res-bg-secondary);
    border-radius: 8px;
}
`);
    }

    // Return an object containing the functions this module exports
    return {
        injectPanelStyles
    };
}
