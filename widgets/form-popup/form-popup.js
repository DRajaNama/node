(() => {
  "use strict";

  const API_URL = "http://localhost:3000/api/public/form-popup/";
  const LEAD_SUBMIT_URL = "http://localhost:3000/api/public/lead/submit";
  const SCRIPT_SELECTOR = "script[data-popup-id]";
  const ROOT_ID = "form-popup-root";
  const CLOSE_MESSAGE = "FORM_POPUP_CLOSE";
  const SUBSCRIBE_MESSAGE = "FORM_POPUP_SUBSCRIBED";
  const SUBMIT_ERROR_MESSAGE = "FORM_POPUP_SUBMIT_ERROR";
  const CLOSE_COOLDOWN = 60 * 60 * 1000;
  const STORAGE_PREFIX = "form_popup_state_";

  function getScript() {
    return document.currentScript || document.querySelector(SCRIPT_SELECTOR);
  }

  function getPopupId() {
    const script = getScript();
    if (!script) throw new Error("[FormPopup] Script element not found");
    const popupId = script.getAttribute("data-popup-id");
    if (!popupId) throw new Error("[FormPopup] data-popup-id is missing");
    return popupId;
  }

  function getStorageKey(popupId) {
    return STORAGE_PREFIX + popupId;
  }

  function getPopupState(popupId) {
    try {
      const value = localStorage.getItem(getStorageKey(popupId));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn("[FormPopup] Unable to read localStorage:", error);
      return null;
    }
  }

  function savePopupState(popupId, state) {
    try {
      localStorage.setItem(getStorageKey(popupId), JSON.stringify(state));
    } catch (error) {
      console.warn("[FormPopup] Unable to save localStorage:", error);
    }
  }

  function markSubscribed(popupId) {
    savePopupState(popupId, {
      status: "subscribed",
      timestamp: Date.now()
    });
  }

  function markClosed(popupId) {
    savePopupState(popupId, {
      status: "closed",
      timestamp: Date.now()
    });
  }

  function shouldShowPopup(popupId) {
    const state = getPopupState(popupId);

    if (!state) return true;
    if (state.status === "subscribed") return false;

    if (state.status === "closed") {
      const elapsed = Date.now() - Number(state.timestamp || 0);

      if (elapsed < CLOSE_COOLDOWN) return false;

      try {
        localStorage.removeItem(getStorageKey(popupId));
      } catch (error) {}

      return true;
    }

    return true;
  }

  async function getPopup(popupId) {
    const url = API_URL + encodeURIComponent(popupId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const result = await response.json();

    if (!result || !result.data) {
      throw new Error("[FormPopup] Invalid API response");
    }

    if (!result.data.html) {
      throw new Error("[FormPopup] Popup HTML is empty");
    }

    return result.data;
  }

  function injectWidgetStyles(html) {
    const css = `<style id="form-popup-widget-style">
html,body{margin:0!important;padding:0!important;width:100%!important;min-width:0!important;overflow-x:hidden!important;-webkit-text-size-adjust:100%}
body{box-sizing:border-box!important}
*,*::before,*::after{box-sizing:border-box!important}
img{max-width:100%!important;height:auto!important}
table{max-width:100%!important}
.ve-popup-container{width:100%!important;max-width:100%!important;margin:0!important;box-sizing:border-box!important}
.ve-popup-container img{max-width:100%!important;height:auto!important}
input,textarea,select,button{max-width:100%}
</style>`;

    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, css + "</head>");
    }

    return css + html;
  }

  function injectWidgetScript(html, popupId, popupName) {
    const safePopupId = String(popupId)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const safePopupName = String(popupName || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const safeLeadUrl = LEAD_SUBMIT_URL
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const script = `<script>
(() => {
  "use strict";

  const LEAD_SUBMIT_URL = "${safeLeadUrl}";
  const POPUP_ID = "${safePopupId}";
  const POPUP_NAME = "${safePopupName}";

  document.addEventListener("click", function(event) {
    const button = event.target.closest(".ve-close-button");
    if (!button) return;

    window.parent.postMessage({
      type: "FORM_POPUP_CLOSE"
    }, "*");
  });

  document.addEventListener("submit", async function(event) {
    const form = event.target;

    if (!form || form.tagName !== "FORM") return;

    event.preventDefault();
    event.stopPropagation();

    if (typeof form.checkValidity === "function" && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (form.dataset.submitting === "true") return;

    form.dataset.submitting = "true";

    const submitButton = form.querySelector(
      'button[type="submit"],input[type="submit"]'
    );

    const originalText = submitButton ? submitButton.innerHTML : "";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = "Submitting...";
    }

    try {
      const formData = new FormData(form);
      const payload = {};

      formData.forEach((value, key) => {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          if (Array.isArray(payload[key])) {
            payload[key].push(value);
          } else {
            payload[key] = [payload[key], value];
          }
        } else {
          payload[key] = value;
        }
      });

      payload.formPopupId = POPUP_ID;
      payload.source = "form-popup";
      payload.popupName = POPUP_NAME;

      const response = await fetch(LEAD_SUBMIT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
        credentials: "include"
      });

      let result = null;

      try {
        result = await response.json();
      } catch (error) {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result && result.message
            ? result.message
            : "Lead submission failed"
        );
      }

      window.parent.postMessage({
        type: "FORM_POPUP_SUBSCRIBED",
        response: result
      }, "*");
    } catch (error) {
      console.error("[FormPopup] Lead submission error:", error);

      window.parent.postMessage({
        type: "FORM_POPUP_SUBMIT_ERROR",
        message: error.message || "Unable to submit form."
      }, "*");

      form.dataset.submitting = "false";

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    }
  }, true);
})();
<\/script>`;

    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, script + "</body>");
    }

    return html + script;
  }

  function prepareHtml(html, popupId, popupName) {
    html = injectWidgetStyles(html);
    html = injectWidgetScript(html, popupId, popupName);
    return html;
  }

  function getPositionStyle(position) {
    switch (String(position || "center").toLowerCase()) {
      case "top":
        return {
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: "40px"
        };
      case "bottom":
        return {
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: "40px"
        };
      case "top-left":
        return {
          alignItems: "flex-start",
          justifyContent: "flex-start",
          paddingTop: "40px",
          paddingLeft: "40px"
        };
      case "top-right":
        return {
          alignItems: "flex-start",
          justifyContent: "flex-end",
          paddingTop: "40px",
          paddingRight: "40px"
        };
      case "bottom-left":
        return {
          alignItems: "flex-end",
          justifyContent: "flex-start",
          paddingBottom: "40px",
          paddingLeft: "40px"
        };
      case "bottom-right":
        return {
          alignItems: "flex-end",
          justifyContent: "flex-end",
          paddingBottom: "40px",
          paddingRight: "40px"
        };
      case "center":
      default:
        return {
          alignItems: "center",
          justifyContent: "center"
        };
    }
  }

  function getWidth(width) {
    if (typeof width === "number") return width + "px";
    if (typeof width === "string" && width.trim()) return width;
    return "420px";
  }

  function resizeIframe(iframe) {
    try {
      const iframeDocument =
        iframe.contentDocument ||
        iframe.contentWindow.document;

      if (!iframeDocument) return;

      const body = iframeDocument.body;
      const documentElement = iframeDocument.documentElement;

      if (!body || !documentElement) return;

      const heights = [
        body.scrollHeight,
        body.offsetHeight,
        body.clientHeight,
        documentElement.scrollHeight,
        documentElement.offsetHeight,
        documentElement.clientHeight
      ];

      const contentHeight = Math.max(...heights, 0);
      const maxHeight = Math.floor(window.innerHeight * 0.9);
      const finalHeight = Math.min(contentHeight, maxHeight);

      iframe.style.height = Math.max(finalHeight, 1) + "px";

      if (contentHeight > maxHeight) {
        iframe.style.overflow = "auto";
        iframe.setAttribute("scrolling", "yes");
      } else {
        iframe.style.overflow = "hidden";
        iframe.setAttribute("scrolling", "no");
      }
    } catch (error) {
      console.error("[FormPopup] iframe resize error:", error);
    }
  }

  function observeIframe(iframe) {
    try {
      const iframeDocument =
        iframe.contentDocument ||
        iframe.contentWindow.document;

      if (!iframeDocument) return null;

      const target =
        iframeDocument.body ||
        iframeDocument.documentElement;

      if (!target) return null;

      const observer = new MutationObserver(() => {
        resizeIframe(iframe);
      });

      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true
      });

      Array.from(iframeDocument.images).forEach(image => {
        image.addEventListener("load", () => {
          resizeIframe(iframe);
        });
      });

      return observer;
    } catch (error) {
      console.error("[FormPopup] Observer error:", error);
      return null;
    }
  }

  function showPopup(data, popupId) {
    const settings = data.settings || {};
    const existing = document.getElementById(ROOT_ID);

    if (existing) existing.remove();

    const root = document.createElement("div");

    root.id = ROOT_ID;
    root.setAttribute("data-form-popup", "true");

    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      zIndex: String(settings.zIndex || 2147483647),
      margin: "0",
      padding: "0"
    });

    const overlay = document.createElement("div");
    const positionStyle = getPositionStyle(settings.position);

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "flex",
      background: settings.overlay || "rgba(0,0,0,.55)",
      padding: "20px",
      boxSizing: "border-box",
      overflow: "hidden",
      ...positionStyle
    });

    const iframe = document.createElement("iframe");

    iframe.setAttribute("title", data.name || "Form Popup");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("allowtransparency", "true");

    Object.assign(iframe.style, {
      display: "block",
      border: "0",
      margin: "0",
      padding: "0",
      background: "#fff",
      width: getWidth(settings.width),
      maxWidth: "92vw",
      height: "1px",
      maxHeight: "90vh",
      overflow: "hidden",
      borderRadius: settings.borderRadius || "12px",
      boxShadow: "0 12px 40px rgba(0,0,0,.18)"
    });

    iframe.srcdoc = prepareHtml(
      data.html,
      popupId,
      data.name
    );

    iframe.addEventListener("load", () => {
      resizeIframe(iframe);
      observeIframe(iframe);

      setTimeout(() => resizeIframe(iframe), 100);
      setTimeout(() => resizeIframe(iframe), 500);
      setTimeout(() => resizeIframe(iframe), 1000);
    });

    const resizeHandler = () => {
      resizeIframe(iframe);
    };

    window.addEventListener("resize", resizeHandler);

    let popupClosed = false;

    function closePopup() {
      if (popupClosed) return;

      popupClosed = true;

      const currentState = getPopupState(popupId);

      if (
        !currentState ||
        currentState.status !== "subscribed"
      ) {
        markClosed(popupId);
      }

      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("message", messageHandler);

      root.remove();
    }

    function messageHandler(event) {
      if (!event.data) return;

      if (event.source !== iframe.contentWindow) return;

      if (event.data.type === SUBSCRIBE_MESSAGE) {
        markSubscribed(popupId);
        closePopup();
        return;
      }

      if (event.data.type === SUBMIT_ERROR_MESSAGE) {
        console.error(
          "[FormPopup] Lead submission failed:",
          event.data.message
        );
        return;
      }

      if (event.data.type === CLOSE_MESSAGE) {
        closePopup();
      }
    }

    window.addEventListener("message", messageHandler);

    if (settings.closeOnOverlay !== false) {
      overlay.addEventListener("click", event => {
        if (event.target === overlay) {
          closePopup();
        }
      });
    }

    overlay.appendChild(iframe);
    root.appendChild(overlay);
    document.body.appendChild(root);
  }

  async function init() {
    try {
      const popupId = getPopupId();

      if (!shouldShowPopup(popupId)) return;

      const data = await getPopup(popupId);

      if (!shouldShowPopup(popupId)) return;

      const delay = Number(data.settings?.delay || 0);

      if (delay > 0) {
        setTimeout(() => {
          if (shouldShowPopup(popupId)) {
            showPopup(data, popupId);
          }
        }, delay);
      } else {
        showPopup(data, popupId);
      }
    } catch (error) {
      console.error("[FormPopup] Error:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
