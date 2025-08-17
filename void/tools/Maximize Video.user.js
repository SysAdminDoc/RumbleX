// ==UserScript==
// @name                Maximize Video for YouTube & Rumble
// @namespace           https://github.com/SysAdminDoc/RumbleX
// @version             2025.08.17
// @description         Maximizes the video player on YouTube and Rumble. Supports Picture-in-Picture.
// @author              Matthew Parker
// @match               https://*.youtube.com/*
// @match               https://rumble.com/*
// @run-at              document-end
// @downloadURL         https://raw.githubusercontent.com/SysAdminDoc/RumbleX/main/modules/Maximize%20Video.user.js
// @updateURL           https://raw.githubusercontent.com/SysAdminDoc/RumbleX/main/modules/Maximize%20Video.meta.js
// ==/UserScript==

;(() => {
  const gv = {
    isFull: false,
    isIframe: window.top !== window.self,
    player: null,
    playerParents: [],
    btnText: {
      max: "Maximize",
      pip: "Picture-in-Picture",
      tip: "This video is in an iframe. Please click the video first, then try again.",
    },
  };

  // Site-specific rules for the primary video player container.
  const siteRules = {
    "*.youtube.com": ["#movie_player"],
    "rumble.com": [".vid-container"],
  };

  const tool = {
    log(message) {
      console.log(`[Maximize Video] :: ${new Date().toLocaleTimeString()} > ${message}`);
    },

    getRect(element) {
      const rect = element.getBoundingClientRect();
      return {
        screenX: rect.left,
        screenY: rect.top,
      };
    },

    addStyle(css) {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
      return style;
    },

    matchHostname(rule) {
      // Creates a regex from a wildcard rule (e.g., "*.youtube.com")
      const regex = new RegExp(`^${rule.split("*").join(".*")}$`);
      return regex.test(window.location.hostname);
    },

    createButton(id, text, clickHandler) {
      const btn = document.createElement("div");
      btn.id = id;
      btn.textContent = text;
      btn.onclick = clickHandler;
      document.body.appendChild(btn);
      return btn;
    },
  };

  const setButton = {
    init() {
      if (!document.getElementById("mv-control-btn")) {
        // Run main initialization only once
        mainInit();
      }

      // If the video is in a cross-origin iframe and is nearly filling it,
      // notify the parent frame to handle the button display.
      const clientWidth = document.documentElement.clientWidth;
      const clientHeight = document.documentElement.clientHeight;
      if (
        gv.isIframe &&
        Math.abs(clientWidth - gv.player.offsetWidth) < 20 &&
        Math.abs(clientHeight - gv.player.offsetHeight) < 20
      ) {
        window.parent.postMessage("iframeVideoReady", "*");
        return;
      }

      this.show();
    },

    show() {
      gv.player.removeEventListener("mouseleave", handle.leavePlayer, false);
      gv.player.addEventListener("mouseleave", handle.leavePlayer, false);

      if (!gv.isFull) {
        document.addEventListener("scroll", handle.scrollFix, { passive: true });
      }

      gv.controlBtn.style.visibility = "visible";
      // Only show Picture-in-Picture button if the API is enabled and a video element is found
      if (document.pictureInPictureEnabled && gv.player.querySelector("video")) {
        gv.pipBtn.style.visibility = "visible";
      }

      this.locate();
    },

    locate() {
      const playerRect = gv.player.getBoundingClientRect();
      const scrollY = window.scrollY;

      // Position Maximize button
      gv.controlBtn.style.top = `${playerRect.top + scrollY}px`;
      gv.controlBtn.style.left = `${playerRect.right - gv.controlBtn.offsetWidth}px`;

      // Position Picture-in-Picture button
      gv.pipBtn.style.top = `${playerRect.top + scrollY}px`;
      gv.pipBtn.style.left = `${playerRect.right - gv.controlBtn.offsetWidth - gv.pipBtn.offsetWidth - 5}px`;
    },

    hide() {
        if (gv.controlBtn.style.visibility !== "hidden") {
            gv.controlBtn.style.visibility = "hidden";
            gv.pipBtn.style.visibility = "hidden";
            gv.player.removeEventListener("mouseleave", handle.leavePlayer, false);
            document.removeEventListener("scroll", handle.scrollFix, false);
        }
    }
  };

  const handle = {
    getPlayer(e) {
      if (gv.isFull) return;

      let foundPlayers = [];
      const hostname = window.location.hostname;

      // 1. Check site-specific rules first
      for (const rule in siteRules) {
        if (tool.matchHostname(rule)) {
          siteRules[rule].forEach(selector => {
            document.querySelectorAll(selector).forEach(p => foundPlayers.push(p));
          });
          break;
        }
      }

      // 2. Fallback for generic video tags if no rule matched
      if (foundPlayers.length === 0) {
          const videos = document.querySelectorAll("video");
          for (const v of videos) {
              const vRect = v.getBoundingClientRect();
              // Check if mouse is over a sufficiently large video element
              if (
                  e.clientX >= vRect.left && e.clientX <= vRect.right &&
                  e.clientY >= vRect.top && e.clientY <= vRect.bottom &&
                  v.offsetWidth > 399 && v.offsetHeight > 220
              ) {
                  foundPlayers.push(v.parentElement); // Target the container for better behavior
              }
          }
      }

      if (foundPlayers.length > 0) {
        const path = e.composedPath();
        for (const p of foundPlayers) {
          if (path.includes(p)) {
            gv.player = p;
            setButton.init();
            return;
          }
        }
      }
      
      // If no player was found under the cursor, hide the buttons
      if (gv.player) {
          handle.leavePlayer();
      }
    },

    leavePlayer(e) {
        // Add a small delay to prevent flickering when moving mouse over player controls
        gv.leaveTimer = setTimeout(() => {
            setButton.hide();
        }, 100);
    },

    scrollFix() {
      clearTimeout(gv.scrollTimer);
      gv.scrollTimer = setTimeout(setButton.locate, 50);
    },

    hotKey(e) {
      // Use 'Escape' to exit maximization and 'F2' for Picture-in-Picture
      if (e.key === 'Escape' && gv.isFull) {
        maximize.toggle();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        handle.togglePictureInPicture();
      }
    },

    async togglePictureInPicture() {
      const video = gv.player?.querySelector("video");
      if (!video) return;

      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch (error) {
        tool.log(`Picture-in-Picture failed: ${error}`);
      }
    },

    // Handles messages from/to iframes for synchronization
    receiveMessage(e) {
        const actions = {
            "iframeVideoReady": () => {
                tool.log("Message received: iframe video is ready.");
                if (!gv.isFull) {
                    gv.player = e.source.frameElement;
                    setButton.init();
                }
            },
            "enterMax": () => {
                tool.log("Message received: Enter maximization.");
                gv.player = e.source.frameElement;
                if (gv.isIframe) window.parent.postMessage("enterMax", "*");
                maximize.enter();
            },
            "exitMax": () => {
                tool.log("Message received: Exit maximization.");
                if (gv.isIframe) window.parent.postMessage("exitMax", "*");
                maximize.exit();
            },
            "syncEnter": () => {
                gv.player.contentWindow.postMessage("syncEnter", "*");
                maximize.enter();
            },
            "syncExit": () => {
                gv.player.contentWindow.postMessage("syncExit", "*");
                maximize.exit();
            }
        };

        if (actions[e.data]) {
            actions[e.data]();
        }
    }
  };

  const maximize = {
    toggle() {
      if (!gv.player) return;

      if (!gv.isFull) {
        this.findParents();
        if (gv.isIframe) window.parent.postMessage("enterMax", "*");
        if (gv.player.nodeName === "IFRAME") gv.player.contentWindow.postMessage("syncEnter", "*");
        this.enter();
      } else {
        if (gv.isIframe) window.parent.postMessage("exitMax", "*");
        if (gv.player.nodeName === "IFRAME") gv.player.contentWindow.postMessage("syncExit", "*");
        this.exit();
      }
    },

    findParents() {
      if (gv.isFull) return;
      gv.playerParents = [];
      let el = gv.player;
      while ((el = el.parentNode) && el.nodeName !== "BODY") {
        gv.playerParents.push(el);
      }
    },

    enter() {
        if (gv.isFull) return;
        document.removeEventListener("mouseover", handle.getPlayer, false);
        
        gv.leftBar.style.display = "block";
        gv.rightBar.style.display = "block";
        setButton.hide();

        document.documentElement.classList.add("mv-html");
        document.body.classList.add("mv-body");
        gv.playerParents.forEach(p => p.classList.add("mv-parent"));
        gv.player.classList.add("mv-player");
        
        // Special fix for YouTube's theater mode
        const ytpSizeButton = document.querySelector("#movie_player .ytp-size-button");
        const isTheater = document.querySelector("ytd-watch-flexy[theater]");
        if (ytpSizeButton && !isTheater) {
            ytpSizeButton.click();
            gv.ytpToggled = true;
        }

        window.dispatchEvent(new Event("resize"));
        gv.isFull = true;
    },

    exit() {
        if (!gv.isFull) return;
        document.documentElement.classList.remove("mv-html");
        document.body.classList.remove("mv-body");
        gv.playerParents.forEach(p => {
            p.classList.remove("mv-parent");
        });
        gv.player.classList.remove("mv-player");

        // Revert YouTube theater mode if we enabled it
        if (gv.ytpToggled) {
            document.querySelector("#movie_player .ytp-size-button")?.click();
            gv.ytpToggled = false;
        }
        
        gv.leftBar.style.display = "none";
        gv.rightBar.style.display = "none";

        document.addEventListener("mouseover", handle.getPlayer, false);
        window.dispatchEvent(new Event("resize"));
        gv.isFull = false;
    },
  };

  const mainInit = () => {
    gv.controlBtn = tool.createButton("mv-control-btn", gv.btnText.max, maximize.toggle);
    gv.pipBtn = tool.createButton("mv-pip-btn", gv.btnText.pip, handle.togglePictureInPicture);
    gv.leftBar = tool.createButton("mv-left-bar", "", () => {});
    gv.rightBar = tool.createButton("mv-right-bar", "", () => {});
    
    tool.addStyle(`
        /* Hide scrollbars and lock page when maximized */
        .mv-html, .mv-body { overflow: hidden !important; }
        
        /* Reset parent elements to prevent visual bugs */
        .mv-html .mv-body .mv-parent {
            overflow: visible !important;
            z-index: auto !important;
            transform: none !important;
            contain: none !important;
        }
        
        /* The core style for the maximized player */
        .mv-html .mv-body .mv-player {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 2147483646 !important; /* Max z-index */
            border: none !important;
            background-color: #000 !important;
        }

        /* Ensure video tag fills the container */
        .mv-player video { object-fit: contain !important; }
        
        /* Button Styles */
        #mv-control-btn, #mv-pip-btn {
            visibility: hidden;
            position: absolute;
            z-index: 2147483647;
            background-color: #27A9D8;
            color: #FFF;
            font: 12px "Segoe UI", sans-serif;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.3s ease;
        }
        #mv-control-btn:hover, #mv-pip-btn:hover { opacity: 1; }

        /* Black bars for aspect ratio correction */
        #mv-left-bar, #mv-right-bar {
            display: none;
            position: fixed;
            width: 1px; /* Will be covered by player */
            height: 100vh;
            top: 0;
            z-index: 2147483647;
            background: #000;
        }
        #mv-left-bar { left: 0; }
        #mv-right-bar { right: 0; }
    `);

    document.addEventListener("mouseover", handle.getPlayer, false);
    document.addEventListener("keydown", handle.hotKey, false);
    window.addEventListener("message", handle.receiveMessage, false);
    
    tool.log("Script loaded and ready.");
  };

  // Start the script
  mainInit();
})();