(() => {
  "use strict";

  /*
   * ============================================================
   * Form Popup Embed Widget
   * ============================================================
   */

  const API_URL =
    "http://localhost:3000/api/public/form-popup/";

  const SCRIPT_SELECTOR =
    "script[data-popup-id]";

  const ROOT_ID =
    "form-popup-root";

  const CLOSE_MESSAGE =
    "FORM_POPUP_CLOSE";

  const SUBSCRIBE_MESSAGE =
    "FORM_POPUP_SUBSCRIBED";

  /*
   * User closed popup:
   * Don't show again for 1 hour.
   */
  const CLOSE_COOLDOWN =
    60 * 60 * 1000;

  /*
   * Storage prefix.
   *
   * Popup ID will be added to this key
   * so every popup has its own state.
   */
  const STORAGE_PREFIX =
    "form_popup_state_";


  /*
   * ============================================================
   * Get current widget script
   * ============================================================
   */

  function getScript() {

    return (
      document.currentScript ||
      document.querySelector(
        SCRIPT_SELECTOR
      )
    );

  }


  /*
   * ============================================================
   * Get popup ID
   * ============================================================
   */

  function getPopupId() {

    const script =
      getScript();

    if (!script) {

      throw new Error(
        "[FormPopup] Script element not found"
      );

    }

    const popupId =
      script.getAttribute(
        "data-popup-id"
      );

    if (!popupId) {

      throw new Error(
        "[FormPopup] data-popup-id is missing"
      );

    }

    return popupId;

  }


  /*
   * ============================================================
   * Storage key
   * ============================================================
   */

  function getStorageKey(
    popupId
  ) {

    return (
      STORAGE_PREFIX +
      popupId
    );

  }


  /*
   * ============================================================
   * Get popup state
   *
   * Possible states:
   *
   * {
   *   status: "subscribed"
   * }
   *
   * OR
   *
   * {
   *   status: "closed",
   *   timestamp: 123456789
   * }
   * ============================================================
   */

  function getPopupState(
    popupId
  ) {

    try {

      const key =
        getStorageKey(
          popupId
        );

      const value =
        localStorage.getItem(
          key
        );

      if (!value) {

        return null;

      }

      return JSON.parse(
        value
      );

    } catch (
      error
    ) {

      console.warn(
        "[FormPopup] Unable to read popup state:",
        error
      );

      return null;

    }

  }


  /*
   * ============================================================
   * Save popup state
   * ============================================================
   */

  function savePopupState(
    popupId,
    state
  ) {

    try {

      const key =
        getStorageKey(
          popupId
        );

      localStorage.setItem(
        key,
        JSON.stringify(
          state
        )
      );

    } catch (
      error
    ) {

      console.warn(
        "[FormPopup] Unable to save popup state:",
        error
      );

    }

  }


  /*
   * ============================================================
   * Mark as subscribed
   *
   * Once subscribed, popup will never
   * show again for this popup ID.
   * ============================================================
   */

  function markSubscribed(
    popupId
  ) {

    savePopupState(
      popupId,
      {
        status:
          "subscribed",

        timestamp:
          Date.now()
      }
    );

    console.log(
      "[FormPopup] User subscribed"
    );

  }


  /*
   * ============================================================
   * Mark as closed
   *
   * Popup will not display for 1 hour.
   * ============================================================
   */

  function markClosed(
    popupId
  ) {

    savePopupState(
      popupId,
      {
        status:
          "closed",

        timestamp:
          Date.now()
      }
    );

    console.log(
      "[FormPopup] Popup closed."
    );

    console.log(
      "[FormPopup] Will display again after 1 hour."
    );

  }


  /*
   * ============================================================
   * Check whether popup should be displayed
   * ============================================================
   */

  function shouldShowPopup(
    popupId
  ) {

    const state =
      getPopupState(
        popupId
      );

    /*
     * No previous state.
     *
     * Show popup.
     */

    if (!state) {

      return true;

    }


    /*
     * User subscribed.
     *
     * Never show again.
     */

    if (
      state.status ===
      "subscribed"
    ) {

      console.log(
        "[FormPopup] User already subscribed."
      );

      return false;

    }


    /*
     * User closed popup.
     */

    if (
      state.status ===
      "closed"
    ) {

      const closedAt =
        Number(
          state.timestamp || 0
        );

      const elapsed =
        Date.now() -
        closedAt;

      /*
       * Still inside 1-hour
       * cooldown.
       */

      if (
        elapsed <
        CLOSE_COOLDOWN
      ) {

        const remaining =
          CLOSE_COOLDOWN -
          elapsed;

        const remainingMinutes =
          Math.ceil(
            remaining /
            (60 * 1000)
          );

        console.log(
          "[FormPopup] Popup is in cooldown."
        );

        console.log(
          "[FormPopup] Remaining minutes:",
          remainingMinutes
        );

        return false;

      }


      /*
       * Cooldown expired.
       *
       * Remove old state.
       */

      try {

        localStorage.removeItem(
          getStorageKey(
            popupId
          )
        );

      } catch (
        error
      ) {}

      return true;

    }


    return true;

  }


  /*
   * ============================================================
   * Get popup from API
   * ============================================================
   */

  async function getPopup(
    popupId
  ) {

    const url =
      API_URL +
      encodeURIComponent(
        popupId
      );

    console.log(
      "[FormPopup] API:",
      url
    );

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }

    const result =
      await response.json();

    console.log(
      "[FormPopup] Response:",
      result
    );

    if (
      !result ||
      !result.data
    ) {

      throw new Error(
        "[FormPopup] Invalid API response"
      );

    }

    if (
      !result.data.html
    ) {

      throw new Error(
        "[FormPopup] Popup HTML is empty"
      );

    }

    return result.data;

  }


  /*
   * ============================================================
   * Inject widget CSS
   * ============================================================
   */

  function injectWidgetStyles(
    html
  ) {

    const css = `
      <style id="form-popup-widget-style">

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;

          width: 100% !important;
          min-width: 0 !important;

          overflow-x: hidden !important;

          -webkit-text-size-adjust: 100%;
        }

        body {
          box-sizing: border-box !important;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box !important;
        }

        img {
          max-width: 100% !important;
          height: auto !important;
        }

        table {
          max-width: 100% !important;
        }

        .ve-popup-container {
          width: 100% !important;
          max-width: 100% !important;

          margin: 0 !important;

          box-sizing: border-box !important;
        }

        .ve-popup-container img {
          max-width: 100% !important;
          height: auto !important;
        }

        input,
        textarea,
        select,
        button {
          max-width: 100%;
        }

      </style>
    `;

    if (
      /<\/head>/i.test(
        html
      )
    ) {

      return html.replace(
        /<\/head>/i,
        css +
        "</head>"
      );

    }

    return (
      css +
      html
    );

  }


  /*
   * ============================================================
   * Inject communication script
   *
   * This script runs INSIDE the iframe.
   *
   * It detects:
   *
   * 1. Close button
   * 2. Form submit
   * ============================================================
   */

  function injectWidgetScript(
    html
  ) {

    const script = `
      <script>
        (() => {

          /*
           * ================================================
           * CLOSE BUTTON
           * ================================================
           */

          document.addEventListener(
            "click",
            function(event) {

              const button =
                event.target.closest(
                  ".ve-close-button"
                );

              if (!button) {
                return;
              }

              window.parent.postMessage(
                {
                  type:
                    "${CLOSE_MESSAGE}"
                },
                "*"
              );

            }
          );


          /*
           * ================================================
           * FORM SUBMIT
           * ================================================
           *
           * The browser's native validation happens
           * before the submit event.
           *
           * Therefore invalid forms will NOT trigger
           * this event.
           *
           * Once submit fires, we consider the user
           * subscribed.
           * ================================================
           */

          document.addEventListener(
            "submit",
            function(event) {

              const form =
                event.target;

              if (
                !form ||
                form.tagName !==
                  "FORM"
              ) {

                return;

              }

              /*
               * Tell parent page that
               * subscription happened.
               */

              window.parent.postMessage(
                {
                  type:
                    "${SUBSCRIBE_MESSAGE}"
                },
                "*"
              );

            },
            true
          );

        })();
      <\/script>
    `;

    if (
      /<\/body>/i.test(
        html
      )
    ) {

      return html.replace(
        /<\/body>/i,
        script +
        "</body>"
      );

    }

    return (
      html +
      script
    );

  }


  /*
   * ============================================================
   * Prepare HTML
   * ============================================================
   */

  function prepareHtml(
    html
  ) {

    html =
      injectWidgetStyles(
        html
      );

    html =
      injectWidgetScript(
        html
      );

    return html;

  }


  /*
   * ============================================================
   * Get popup position
   * ============================================================
   */

  function getPositionStyle(
    position
  ) {

    switch (
      String(
        position ||
        "center"
      ).toLowerCase()
    ) {

      case "top":

        return {

          alignItems:
            "flex-start",

          justifyContent:
            "center",

          paddingTop:
            "40px"

        };


      case "bottom":

        return {

          alignItems:
            "flex-end",

          justifyContent:
            "center",

          paddingBottom:
            "40px"

        };


      case "top-left":

        return {

          alignItems:
            "flex-start",

          justifyContent:
            "flex-start",

          paddingTop:
            "40px",

          paddingLeft:
            "40px"

        };


      case "top-right":

        return {

          alignItems:
            "flex-start",

          justifyContent:
            "flex-end",

          paddingTop:
            "40px",

          paddingRight:
            "40px"

        };


      case "bottom-left":

        return {

          alignItems:
            "flex-end",

          justifyContent:
            "flex-start",

          paddingBottom:
            "40px",

          paddingLeft:
            "40px"

        };


      case "bottom-right":

        return {

          alignItems:
            "flex-end",

          justifyContent:
            "flex-end",

          paddingBottom:
            "40px",

          paddingRight:
            "40px"

        };


      case "center":

      default:

        return {

          alignItems:
            "center",

          justifyContent:
            "center"

        };

    }

  }


  /*
   * ============================================================
   * Convert width to CSS
   * ============================================================
   */

  function getWidth(
    width
  ) {

    if (
      typeof width ===
      "number"
    ) {

      return (
        width +
        "px"
      );

    }

    if (
      typeof width ===
      "string" &&
      width.trim()
    ) {

      return width;

    }

    return "420px";

  }


  /*
   * ============================================================
   * Resize iframe
   * ============================================================
   */

  function resizeIframe(
    iframe
  ) {

    try {

      const iframeDocument =
        iframe.contentDocument ||
        iframe.contentWindow.document;

      if (
        !iframeDocument
      ) {

        return;

      }

      const body =
        iframeDocument.body;

      const documentElement =
        iframeDocument.documentElement;

      if (
        !body ||
        !documentElement
      ) {

        return;

      }

      const heights = [

        body.scrollHeight,

        body.offsetHeight,

        body.clientHeight,

        documentElement.scrollHeight,

        documentElement.offsetHeight,

        documentElement.clientHeight

      ];

      const contentHeight =
        Math.max(
          ...heights,
          0
        );


      /*
       * Maximum popup height:
       * 90% of viewport
       */

      const maxHeight =
        Math.floor(
          window.innerHeight *
          0.9
        );


      /*
       * Final height
       */

      const finalHeight =
        Math.min(
          contentHeight,
          maxHeight
        );


      iframe.style.height =
        Math.max(
          finalHeight,
          1
        ) +
        "px";


      /*
       * Enable scrolling only if
       * popup is taller than viewport.
       */

      if (
        contentHeight >
        maxHeight
      ) {

        iframe.style.overflow =
          "auto";

        iframe.setAttribute(
          "scrolling",
          "yes"
        );

      } else {

        iframe.style.overflow =
          "hidden";

        iframe.setAttribute(
          "scrolling",
          "no"
        );

      }

    } catch (
      error
    ) {

      console.error(
        "[FormPopup] iframe resize error:",
        error
      );

    }

  }


  /*
   * ============================================================
   * Observe iframe changes
   * ============================================================
   */

  function observeIframe(
    iframe
  ) {

    try {

      const iframeDocument =
        iframe.contentDocument ||
        iframe.contentWindow.document;

      if (
        !iframeDocument
      ) {

        return null;

      }

      const target =
        iframeDocument.body ||
        iframeDocument.documentElement;

      if (
        !target
      ) {

        return null;

      }

      const observer =
        new MutationObserver(
          () => {

            resizeIframe(
              iframe
            );

          }
        );

      observer.observe(
        target,
        {
          childList:
            true,

          subtree:
            true,

          attributes:
            true
        }
      );


      /*
       * Recalculate after images
       */

      const images =
        iframeDocument.images;

      Array.from(
        images
      ).forEach(
        image => {

          image.addEventListener(
            "load",
            () => {

              resizeIframe(
                iframe
              );

            }
          );

        }
      );


      return observer;

    } catch (
      error
    ) {

      console.error(
        "[FormPopup] Observer error:",
        error
      );

      return null;

    }

  }


  /*
   * ============================================================
   * Create popup
   * ============================================================
   */

  function showPopup(
    data,
    popupId
  ) {

    const settings =
      data.settings ||
      {};


    /*
     * Remove existing popup
     */

    const existing =
      document.getElementById(
        ROOT_ID
      );

    if (
      existing
    ) {

      existing.remove();

    }


    /*
     * ROOT
     */

    const root =
      document.createElement(
        "div"
      );

    root.id =
      ROOT_ID;

    root.setAttribute(
      "data-form-popup",
      "true"
    );


    Object.assign(
      root.style,
      {

        position:
          "fixed",

        inset:
          "0",

        width:
          "100vw",

        height:
          "100vh",

        zIndex:
          String(
            settings.zIndex ||
            2147483647
          ),

        margin:
          "0",

        padding:
          "0"

      }
    );


    /*
     * OVERLAY
     */

    const overlay =
      document.createElement(
        "div"
      );


    const positionStyle =
      getPositionStyle(
        settings.position
      );


    Object.assign(
      overlay.style,
      {

        position:
          "fixed",

        inset:
          "0",

        width:
          "100%",

        height:
          "100%",

        display:
          "flex",

        background:
          settings.overlay ||
          "rgba(0,0,0,.55)",

        padding:
          "20px",

        boxSizing:
          "border-box",

        overflow:
          "hidden",

        ...positionStyle

      }
    );


    /*
     * IFRAME
     */

    const iframe =
      document.createElement(
        "iframe"
      );


    iframe.setAttribute(
      "title",
      data.name ||
        "Form Popup"
    );

    iframe.setAttribute(
      "frameborder",
      "0"
    );

    iframe.setAttribute(
      "scrolling",
      "no"
    );

    iframe.setAttribute(
      "allowtransparency",
      "true"
    );


    Object.assign(
      iframe.style,
      {

        display:
          "block",

        border:
          "0",

        margin:
          "0",

        padding:
          "0",

        background:
          "#fff",

        width:
          getWidth(
            settings.width
          ),

        maxWidth:
          "92vw",

        height:
          "1px",

        maxHeight:
          "90vh",

        overflow:
          "hidden",

        borderRadius:
          settings.borderRadius ||
          "12px",

        boxShadow:
          "0 12px 40px rgba(0,0,0,.18)"

      }
    );


    /*
     * Prepare HTML
     */

    let html =
      prepareHtml(
        data.html
      );


    /*
     * Set iframe HTML
     */

    iframe.srcdoc =
      html;


    /*
     * ========================================================
     * IFRAME LOAD
     * ========================================================
     */

    iframe.addEventListener(
      "load",
      () => {

        /*
         * Resize immediately
         */

        resizeIframe(
          iframe
        );


        /*
         * Observe dynamic changes
         */

        observeIframe(
          iframe
        );


        /*
         * Resize after resources load
         */

        setTimeout(
          () => {

            resizeIframe(
              iframe
            );

          },
          100
        );


        setTimeout(
          () => {

            resizeIframe(
              iframe
            );

          },
          500
        );


        setTimeout(
          () => {

            resizeIframe(
              iframe
            );

          },
          1000
        );

      }
    );


    /*
     * ========================================================
     * WINDOW RESIZE
     * ========================================================
     */

    const resizeHandler =
      () => {

        resizeIframe(
          iframe
        );

      };


    window.addEventListener(
      "resize",
      resizeHandler
    );


    /*
     * ========================================================
     * CLOSE POPUP
     * ========================================================
     */

    let popupClosed =
      false;


    function closePopup() {

      if (
        popupClosed
      ) {

        return;

      }

      popupClosed =
        true;


      /*
       * Save close state.
       *
       * IMPORTANT:
       * Only save "closed" if the user
       * has NOT subscribed.
       */

      const state =
        getPopupState(
          popupId
        );

      if (
        !state ||
        state.status !==
          "subscribed"
      ) {

        markClosed(
          popupId
        );

      }


      /*
       * Cleanup
       */

      window.removeEventListener(
        "resize",
        resizeHandler
      );

      window.removeEventListener(
        "message",
        messageHandler
      );


      /*
       * Remove popup
       */

      root.remove();

    }


    /*
     * ========================================================
     * MESSAGE HANDLER
     * ========================================================
     */

    const messageHandler =
      event => {

        if (
          !event.data
        ) {

          return;

        }


        /*
         * Only accept messages
         * from our iframe.
         */

        if (
          event.source !==
          iframe.contentWindow
        ) {

          return;

        }


        /*
         * USER SUBSCRIBED
         */

        if (
          event.data.type ===
          SUBSCRIBE_MESSAGE
        ) {

          console.log(
            "[FormPopup] Subscription detected"
          );


          /*
           * Save permanent subscribed
           * state.
           */

          markSubscribed(
            popupId
          );


          /*
           * Close popup immediately.
           */

          closePopup();


          return;

        }


        /*
         * USER CLOSED
         */

        if (
          event.data.type ===
          CLOSE_MESSAGE
        ) {

          closePopup();

        }

      };


    window.addEventListener(
      "message",
      messageHandler
    );


    /*
     * ========================================================
     * OVERLAY CLICK
     * ========================================================
     */

    if (
      settings.closeOnOverlay !==
      false
    ) {

      overlay.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            overlay
          ) {

            closePopup();

          }

        }
      );

    }


    /*
     * ========================================================
     * ASSEMBLE
     * ========================================================
     */

    overlay.appendChild(
      iframe
    );

    root.appendChild(
      overlay
    );


    /*
     * Add popup directly
     * to customer's BODY
     */

    document.body.appendChild(
      root
    );


    console.log(
      "[FormPopup] Popup displayed"
    );

  }


  /*
   * ============================================================
   * INITIALIZE
   * ============================================================
   */

  async function init() {

    try {

      console.log(
        "[FormPopup] Initializing..."
      );


      /*
       * Get popup ID
       */

      const popupId =
        getPopupId();


      console.log(
        "[FormPopup] Popup ID:",
        popupId
      );


      /*
       * Check local storage BEFORE
       * making API request.
       */

      if (
        !shouldShowPopup(
          popupId
        )
      ) {

        console.log(
          "[FormPopup] Popup will not be displayed."
        );

        return;

      }


      /*
       * Get popup from API
       */

      const data =
        await getPopup(
          popupId
        );


      /*
       * Check again after API call.
       *
       * This protects against another
       * tab/window changing the state
       * while the API request was running.
       */

      if (
        !shouldShowPopup(
          popupId
        )
      ) {

        console.log(
          "[FormPopup] Popup state changed. Not displaying."
        );

        return;

      }


      /*
       * Delay
       */

      const delay =
        Number(
          data.settings?.delay ||
          0
        );


      if (
        delay > 0
      ) {

        console.log(
          "[FormPopup] Display delay:",
          delay,
          "ms"
        );


        setTimeout(
          () => {

            /*
             * Check one more time
             * before displaying.
             */

            if (
              shouldShowPopup(
                popupId
              )
            ) {

              showPopup(
                data,
                popupId
              );

            }

          },
          delay
        );

      } else {

        showPopup(
          data,
          popupId
        );

      }

    } catch (
      error
    ) {

      console.error(
        "[FormPopup] Error:",
        error
      );

    }

  }


  /*
   * ============================================================
   * START
   * ============================================================
   */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once:
          true
      }
    );

  } else {

    init();

  }

})();
