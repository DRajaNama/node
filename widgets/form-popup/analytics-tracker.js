(() => {
  "use strict";

  /**
   * VEAnalytics
   *
   * First-party website analytics tracker.
   *
   * Features:
   * - Persistent visitor ID cookie
   * - Session ID
   * - IndexedDB offline queue
   * - 10-second local checkpoint
   * - 30-second heartbeat
   * - Retry queued events when online
   * - sendBeacon() on page exit
   * - Active/idle time
   * - Page views
   * - SPA navigation
   * - Click tracking
   * - Scroll tracking
   * - Download tracking
   * - External link tracking
   * - UTM/referrer tracking
   * - Device/browser/OS
   * - Popup events
   * - Form events
   * - Performance
   * - JS errors
   */

  class VEAnalytics {
    constructor(options = {}) {
      this.config = {
        endpoint:
          options.endpoint ||
          "http://localhost:3000/api/public/analytics/track",

        visitorCookie:
          options.visitorCookie ||
          "ve_visitor_id",

        visitorCookieDays:
          Number(options.visitorCookieDays || 730),

        sessionStorageKey:
          options.sessionStorageKey ||
          "ve_session_id",

        checkpointStorageKey:
          options.checkpointStorageKey ||
          "ve_analytics_checkpoint",

        indexedDBName:
          options.indexedDBName ||
          "VEAnalyticsDB",

        indexedDBVersion:
          Number(options.indexedDBVersion || 1),

        eventStore:
          options.eventStore ||
          "events",

        heartbeatInterval:
          Number(
            options.heartbeatInterval ||
              30 * 1000
          ),

        checkpointInterval:
          Number(
            options.checkpointInterval ||
              10 * 1000
          ),

        idleTimeout:
          Number(
            options.idleTimeout ||
              30 * 1000
          ),

        requestTimeout:
          Number(
            options.requestTimeout ||
              10000
          ),

        maxQueueSize:
          Number(
            options.maxQueueSize ||
              5000
          ),

        trackClicks:
          options.trackClicks !== false,

        trackScroll:
          options.trackScroll !== false,

        trackDownloads:
          options.trackDownloads !== false,

        trackExternalLinks:
          options.trackExternalLinks !== false,

        trackErrors:
          options.trackErrors !== false,

        trackPerformance:
          options.trackPerformance !== false,

        debug:
          options.debug === true
      };

      this.visitorId = null;
      this.sessionId = null;

      this.sessionStartedAt = null;
      this.lastActivityAt = null;

      this.activeSeconds = 0;
      this.idleSeconds = 0;

      this.sessionEnded = false;
      this.initialized = false;

      this.heartbeatTimer = null;
      this.checkpointTimer = null;
      this.activeTimer = null;

      this.flushInProgress = false;

      this.currentPageStartedAt = null;
      this.currentPageUrl = null;

      this.scrollMilestones = new Set();

      this.db = null;

      this.originalPushState =
        window.history &&
        window.history.pushState
          ? window.history.pushState
          : null;

      this.originalReplaceState =
        window.history &&
        window.history.replaceState
          ? window.history.replaceState
          : null;

      this.boundHandlers = {};
    }

    /**
     * ---------------------------------------------------------
     * Logging
     * ---------------------------------------------------------
     */

    log(...args) {
      if (this.config.debug) {
        console.log("[VEAnalytics]", ...args);
      }
    }

    warn(...args) {
      if (this.config.debug) {
        console.warn("[VEAnalytics]", ...args);
      }
    }

    /**
     * ---------------------------------------------------------
     * UUID
     * ---------------------------------------------------------
     */

    generateId() {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
      ) {
        return crypto.randomUUID();
      }

      if (
        typeof crypto !== "undefined" &&
        crypto.getRandomValues
      ) {
        const bytes =
          new Uint8Array(16);

        crypto.getRandomValues(bytes);

        bytes[6] =
          (bytes[6] & 0x0f) | 0x40;

        bytes[8] =
          (bytes[8] & 0x3f) | 0x80;

        return Array.from(bytes)
          .map((byte, index) => {
            const hex =
              byte
                .toString(16)
                .padStart(2, "0");

            if (
              index === 4 ||
              index === 6 ||
              index === 8 ||
              index === 10
            ) {
              return "-" + hex;
            }

            return hex;
          })
          .join("");
      }

      return (
        Date.now().toString(36) +
        "-" +
        Math.random()
          .toString(36)
          .substring(2) +
        "-" +
        Math.random()
          .toString(36)
          .substring(2)
      );
    }

    /**
     * ---------------------------------------------------------
     * Cookie
     * ---------------------------------------------------------
     */

    getCookie(name) {
      try {
        const prefix =
          encodeURIComponent(name) + "=";

        const cookies =
          document.cookie
            ? document.cookie.split("; ")
            : [];

        for (const cookie of cookies) {
          if (cookie.indexOf(prefix) === 0) {
            return decodeURIComponent(
              cookie.substring(
                prefix.length
              )
            );
          }
        }
      } catch (error) {
        this.warn(
          "Cookie read failed",
          error
        );
      }

      return null;
    }

    setCookie(name, value, days) {
      try {
        const maxAge =
          Math.floor(
            days * 24 * 60 * 60
          );

        document.cookie =
          encodeURIComponent(name) +
          "=" +
          encodeURIComponent(value) +
          "; Max-Age=" +
          maxAge +
          "; Path=/" +
          "; SameSite=Lax";
      } catch (error) {
        this.warn(
          "Cookie write failed",
          error
        );
      }
    }

    getOrCreateVisitorId() {
      let id = this.getCookie(
        this.config.visitorCookie
      );

      if (id) {
        return id;
      }

      id = this.generateId();

      this.setCookie(
        this.config.visitorCookie,
        id,
        this.config.visitorCookieDays
      );

      return id;
    }

    /**
     * ---------------------------------------------------------
     * Session
     * ---------------------------------------------------------
     */

    getOrCreateSessionId() {
      try {
        let id =
          sessionStorage.getItem(
            this.config.sessionStorageKey
          );

        if (!id) {
          id = this.generateId();

          sessionStorage.setItem(
            this.config.sessionStorageKey,
            id
          );
        }

        return id;
      } catch (error) {
        return this.generateId();
      }
    }

    /**
     * ---------------------------------------------------------
     * IndexedDB
     * ---------------------------------------------------------
     */

    openDatabase() {
      return new Promise(
        (resolve, reject) => {
          if (!window.indexedDB) {
            reject(
              new Error(
                "IndexedDB is not supported"
              )
            );

            return;
          }

          const request =
            indexedDB.open(
              this.config.indexedDBName,
              this.config.indexedDBVersion
            );

          request.onupgradeneeded = event => {
            const db =
              event.target.result;

            if (
              !db.objectStoreNames.contains(
                this.config.eventStore
              )
            ) {
              const store =
                db.createObjectStore(
                  this.config.eventStore,
                  {
                    keyPath: "eventId"
                  }
                );

              store.createIndex(
                "createdAt",
                "createdAt",
                {
                  unique: false
                }
              );
            }
          };

          request.onsuccess = event => {
            this.db =
              event.target.result;

            resolve(this.db);
          };

          request.onerror = () => {
            reject(
              request.error ||
                new Error(
                  "IndexedDB open failed"
                )
            );
          };
        }
      );
    }

    addEventToQueue(event) {
      return new Promise(
        (resolve, reject) => {
          if (!this.db) {
            reject(
              new Error(
                "IndexedDB not initialized"
              )
            );

            return;
          }

          const transaction =
            this.db.transaction(
              [this.config.eventStore],
              "readwrite"
            );

          const store =
            transaction.objectStore(
              this.config.eventStore
            );

          const request =
            store.put(event);

          request.onsuccess = () =>
            resolve();

          request.onerror = () =>
            reject(
              request.error ||
                new Error(
                  "Unable to queue event"
                )
            );
        }
      );
    }

    getQueuedEvents() {
      return new Promise(
        (resolve, reject) => {
          if (!this.db) {
            resolve([]);
            return;
          }

          const transaction =
            this.db.transaction(
              [this.config.eventStore],
              "readonly"
            );

          const store =
            transaction.objectStore(
              this.config.eventStore
            );

          const request =
            store.getAll();

          request.onsuccess = () => {
            const events =
              request.result || [];

            events.sort(
              (a, b) =>
                new Date(a.createdAt) -
                new Date(b.createdAt)
            );

            resolve(events);
          };

          request.onerror = () =>
            reject(
              request.error
            );
        }
      );
    }

    deleteEvent(eventId) {
      return new Promise(
        (resolve, reject) => {
          if (!this.db) {
            resolve();
            return;
          }

          const transaction =
            this.db.transaction(
              [this.config.eventStore],
              "readwrite"
            );

          const store =
            transaction.objectStore(
              this.config.eventStore
            );

          const request =
            store.delete(eventId);

          request.onsuccess = () =>
            resolve();

          request.onerror = () =>
            reject(
              request.error
            );
        }
      );
    }

    async enforceQueueLimit() {
      try {
        const events =
          await this.getQueuedEvents();

        if (
          events.length <=
          this.config.maxQueueSize
        ) {
          return;
        }

        const removeCount =
          events.length -
          this.config.maxQueueSize;

        for (
          let i = 0;
          i < removeCount;
          i++
        ) {
          await this.deleteEvent(
            events[i].eventId
          );
        }
      } catch (error) {
        this.warn(
          "Queue cleanup failed",
          error
        );
      }
    }

    /**
     * ---------------------------------------------------------
     * Checkpoint
     * ---------------------------------------------------------
     */

    saveCheckpoint() {
      const checkpoint = {
        visitorId: this.visitorId,
        sessionId: this.sessionId,

        sessionStartedAt:
          this.sessionStartedAt,

        lastActivityAt:
          this.lastActivityAt,

        activeSeconds:
          this.activeSeconds,

        idleSeconds:
          this.idleSeconds,

        currentPageUrl:
          this.currentPageUrl,

        currentPageStartedAt:
          this.currentPageStartedAt,

        savedAt:
          Date.now()
      };

      try {
        localStorage.setItem(
          this.config.checkpointStorageKey,
          JSON.stringify(checkpoint)
        );
      } catch (error) {
        this.warn(
          "Checkpoint save failed",
          error
        );
      }
    }

    getCheckpoint() {
      try {
        const value =
          localStorage.getItem(
            this.config.checkpointStorageKey
          );

        if (!value) {
          return null;
        }

        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    }

    clearCheckpoint() {
      try {
        localStorage.removeItem(
          this.config.checkpointStorageKey
        );
      } catch (error) {}
    }

    /**
     * ---------------------------------------------------------
     * Device
     * ---------------------------------------------------------
     */

    getDeviceType() {
      const ua =
        navigator.userAgent || "";

      const width =
        window.innerWidth ||
        screen.width ||
        0;

      if (
        /iPad|Tablet|Android(?!.*Mobile)/i.test(
          ua
        )
      ) {
        return "tablet";
      }

      if (
        /Mobile|Android|iPhone|iPod|Windows Phone/i.test(
          ua
        ) ||
        width <= 767
      ) {
        return "mobile";
      }

      return "desktop";
    }

    getOS() {
      const ua =
        navigator.userAgent || "";

      if (/Windows NT/i.test(ua)) {
        return "Windows";
      }

      if (/Android/i.test(ua)) {
        return "Android";
      }

      if (/iPhone|iPad|iPod/i.test(ua)) {
        return "iOS";
      }

      if (/Mac OS X/i.test(ua)) {
        return "macOS";
      }

      if (/Linux/i.test(ua)) {
        return "Linux";
      }

      return "Unknown";
    }

    getBrowser() {
      const ua =
        navigator.userAgent || "";

      if (/Edg\//i.test(ua)) {
        return "Edge";
      }

      if (/OPR\//i.test(ua)) {
        return "Opera";
      }

      if (
        /Chrome\//i.test(ua) &&
        !/Edg\//i.test(ua)
      ) {
        return "Chrome";
      }

      if (/Firefox\//i.test(ua)) {
        return "Firefox";
      }

      if (
        /Safari\//i.test(ua) &&
        !/Chrome\//i.test(ua)
      ) {
        return "Safari";
      }

      return "Unknown";
    }

    getDeviceData() {
      return {
        type: this.getDeviceType(),

        browser:
          this.getBrowser(),

        os:
          this.getOS(),

        userAgent:
          navigator.userAgent || null,

        language:
          navigator.language || null,

        languages:
          Array.isArray(
            navigator.languages
          )
            ? navigator.languages
            : [],

        timezone:
          Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone || null,

        timezoneOffset:
          new Date().getTimezoneOffset(),

        screenWidth:
          screen.width || null,

        screenHeight:
          screen.height || null,

        viewportWidth:
          window.innerWidth || null,

        viewportHeight:
          window.innerHeight || null,

        colorDepth:
          screen.colorDepth || null,

        pixelRatio:
          window.devicePixelRatio || 1,

        touchPoints:
          navigator.maxTouchPoints || 0
      };
    }

    /**
     * ---------------------------------------------------------
     * Traffic Source
     * ---------------------------------------------------------
     */

    getTrafficData() {
      const params =
        new URLSearchParams(
          window.location.search
        );

      return {
        referrer:
          document.referrer || null,

        utmSource:
          params.get("utm_source"),

        utmMedium:
          params.get("utm_medium"),

        utmCampaign:
          params.get("utm_campaign"),

        utmTerm:
          params.get("utm_term"),

        utmContent:
          params.get("utm_content")
      };
    }

    /**
     * ---------------------------------------------------------
     * Event
     * ---------------------------------------------------------
     */

    buildEvent(type, name, data = {}) {
      return {
        eventId:
          this.generateId(),

        visitorId:
          this.visitorId,

        sessionId:
          this.sessionId,

        type,

        name:
          name || null,

        createdAt:
          new Date().toISOString(),

        timestamp:
          Date.now(),

        page: {
          url:
            window.location.href,

          path:
            window.location.pathname,

          title:
            document.title || null
        },

        traffic:
          this.getTrafficData(),

        device:
          this.getDeviceData(),

        data
      };
    }

    async track(
      type,
      name,
      data = {},
      options = {}
    ) {
      if (
        !this.visitorId ||
        !this.sessionId
      ) {
        return;
      }

      const event =
        this.buildEvent(
          type,
          name,
          data
        );

      try {
        await this.addEventToQueue(
          event
        );

        await this.enforceQueueLimit();

        if (
          options.flush !== false
        ) {
          this.flush();
        }
      } catch (error) {
        this.warn(
          "Event queue failed",
          error
        );
      }

      return event;
    }

    /**
     * ---------------------------------------------------------
     * Server communication
     * ---------------------------------------------------------
     */

    async sendEvent(event) {
      const controller =
        typeof AbortController !==
        "undefined"
          ? new AbortController()
          : null;

      let timeout = null;

      if (controller) {
        timeout = setTimeout(
          () => controller.abort(),
          this.config.requestTimeout
        );
      }

      try {
        const response =
          await fetch(
            this.config.endpoint,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json"
              },

              credentials: "include",

              signal:
                controller
                  ? controller.signal
                  : undefined,

              body:
                JSON.stringify(event)
            }
          );

        if (!response.ok) {
          throw new Error(
            "HTTP " +
              response.status
          );
        }

        return true;
      } catch (error) {
        return false;
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    }

    async flush() {
      if (
        this.flushInProgress ||
        !navigator.onLine
      ) {
        return;
      }

      this.flushInProgress = true;

      try {
        const events =
          await this.getQueuedEvents();

        for (const event of events) {
          const success =
            await this.sendEvent(
              event
            );

          if (!success) {
            break;
          }

          await this.deleteEvent(
            event.eventId
          );
        }
      } catch (error) {
        this.warn(
          "Flush failed",
          error
        );
      } finally {
        this.flushInProgress = false;
      }
    }

    /**
     * ---------------------------------------------------------
     * Session
     * ---------------------------------------------------------
     */

    async start(options = {}) {
      if (this.initialized) {
        return;
      }

      this.visitorId =
        this.getOrCreateVisitorId();

      this.sessionId =
        this.getOrCreateSessionId();

      this.sessionStartedAt =
        Date.now();

      this.lastActivityAt =
        Date.now();

      this.currentPageStartedAt =
        Date.now();

      this.currentPageUrl =
        window.location.href;

      /**
       * IMPORTANT:
       *
       * Send old offline events FIRST.
       */
      await this.flush();

      const checkpoint =
        this.getCheckpoint();

      const hasPreviousSession =
        checkpoint &&
        checkpoint.sessionId &&
        checkpoint.sessionId !==
          this.sessionId;

      await this.track(
        "session",
        "session_start",
        {
          isReturningVisitor:
            !!this.getCookie(
              this.config.visitorCookie
            ),

          previousSessionRecovered:
            !!hasPreviousSession,

          popupId:
            options.popupId || null,

          popupName:
            options.popupName || null
        }
      );

      this.initialized = true;

      this.startTimers();
      this.installListeners();

      await this.track(
        "page",
        "page_view",
        {
          pageNumber: 1
        }
      );

      if (
        this.config.trackPerformance
      ) {
        this.trackPerformance();
      }

      this.clearCheckpoint();

      this.flush();
    }

    startTimers() {
      this.heartbeatTimer =
        setInterval(
          () => {
            if (
              this.sessionEnded
            ) {
              return;
            }

            this.updateActivityTime();

            this.track(
              "session",
              "heartbeat",
              {
                activeSeconds:
                  this.activeSeconds,

                idleSeconds:
                  this.idleSeconds,

                sessionDurationSeconds:
                  Math.floor(
                    (
                      Date.now() -
                      this.sessionStartedAt
                    ) / 1000
                  )
              }
            );
          },
          this.config
            .heartbeatInterval
        );

      this.checkpointTimer =
        setInterval(
          () => {
            this.updateActivityTime();

            this.saveCheckpoint();
          },
          this.config
            .checkpointInterval
        );

      this.activeTimer =
        setInterval(
          () => {
            if (
              this.sessionEnded
            ) {
              return;
            }

            const now =
              Date.now();

            const idleFor =
              now -
              this.lastActivityAt;

            if (
              idleFor <=
              this.config.idleTimeout
            ) {
              this.activeSeconds++;
            } else {
              this.idleSeconds++;
            }
          },
          1000
        );
    }

    updateActivityTime() {
      this.lastActivityAt =
        Date.now();
    }

    /**
     * ---------------------------------------------------------
     * Listeners
     * ---------------------------------------------------------
     */

    installListeners() {
      this.boundHandlers.activity =
        () => {
          this.updateActivityTime();
        };

      [
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart",
        "scroll"
      ].forEach(eventName => {
        window.addEventListener(
          eventName,
          this.boundHandlers.activity,
          {
            passive: true
          }
        );
      });

      this.boundHandlers.visibility =
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            this.updateActivityTime();

            this.track(
              "visibility",
              "visible"
            );
          } else {
            this.updateActivityTime();

            this.saveCheckpoint();

            this.track(
              "visibility",
              "hidden",
              {
                activeSeconds:
                  this.activeSeconds
              }
            );
          }
        };

      document.addEventListener(
        "visibilitychange",
        this.boundHandlers.visibility
      );

      this.boundHandlers.online =
        () => {
          this.log(
            "Network online - flushing queue"
          );

          this.flush();
        };

      window.addEventListener(
        "online",
        this.boundHandlers.online
      );

      this.boundHandlers.offline =
        () => {
          this.log(
            "Network offline"
          );

          this.saveCheckpoint();
        };

      window.addEventListener(
        "offline",
        this.boundHandlers.offline
      );

      this.boundHandlers.pagehide =
        () => {
          this.endSession(
            "pagehide"
          );
        };

      window.addEventListener(
        "pagehide",
        this.boundHandlers.pagehide
      );

      if (
        this.config.trackClicks
      ) {
        this.installClickTracking();
      }

      if (
        this.config.trackScroll
      ) {
        this.installScrollTracking();
      }

      if (
        this.config.trackDownloads
      ) {
        this.installDownloadTracking();
      }

      if (
        this.config.trackExternalLinks
      ) {
        this.installExternalLinkTracking();
      }

      this.installHistoryTracking();

      if (
        this.config.trackErrors
      ) {
        this.installErrorTracking();
      }
    }

    /**
     * ---------------------------------------------------------
     * Click tracking
     * ---------------------------------------------------------
     */

    installClickTracking() {
      document.addEventListener(
        "click",
        event => {
          const target =
            event.target.closest(
              "button, a, [data-track]"
            );

          if (!target) {
            return;
          }

          const customName =
            target.getAttribute(
              "data-track"
            );

          const href =
            target instanceof
            HTMLAnchorElement
              ? target.href
              : null;

          this.track(
            "interaction",
            "click",
            {
              element:
                target.tagName
                  .toLowerCase(),

              trackingName:
                customName,

              id:
                target.id || null,

              className:
                typeof target.className ===
                "string"
                  ? target.className
                  : null,

              href,

              target:
                target.getAttribute(
                  "target"
                )
            }
          );
        },
        true
      );
    }

    /**
     * ---------------------------------------------------------
     * Scroll tracking
     * ---------------------------------------------------------
     */

    installScrollTracking() {
      window.addEventListener(
        "scroll",
        () => {
          const doc =
            document.documentElement;

          const scrollTop =
            window.scrollY ||
            doc.scrollTop ||
            0;

          const maxScroll =
            Math.max(
              1,
              doc.scrollHeight -
                window.innerHeight
            );

          const percentage =
            Math.round(
              (scrollTop /
                maxScroll) *
                100
            );

          const milestones = [
            25,
            50,
            75,
            90,
            100
          ];

          for (
            const milestone of milestones
          ) {
            if (
              percentage >=
                milestone &&
              !this.scrollMilestones.has(
                milestone
              )
            ) {
              this.scrollMilestones.add(
                milestone
              );

              this.track(
                "engagement",
                "scroll",
                {
                  percentage:
                    milestone
                }
              );
            }
          }
        },
        {
          passive: true
        }
      );
    }

    /**
     * ---------------------------------------------------------
     * Downloads
     * ---------------------------------------------------------
     */

    installDownloadTracking() {
      document.addEventListener(
        "click",
        event => {
          const link =
            event.target.closest(
              "a[href]"
            );

          if (!link) {
            return;
          }

          const href =
            link.href || "";

          if (
            !/\.(pdf|zip|doc|docx|xls|xlsx|csv|txt|ppt|pptx)(\?.*)?$/i.test(
              href
            )
          ) {
            return;
          }

          this.track(
            "download",
            "file_download",
            {
              url: href,
              filename:
                href
                  .split("/")
                  .pop()
                  .split("?")[0]
            }
          );
        },
        true
      );
    }

    /**
     * ---------------------------------------------------------
     * External links
     * ---------------------------------------------------------
     */

    installExternalLinkTracking() {
      document.addEventListener(
        "click",
        event => {
          const link =
            event.target.closest(
              "a[href]"
            );

          if (!link) {
            return;
          }

          let url;

          try {
            url = new URL(
              link.href,
              window.location.href
            );
          } catch (error) {
            return;
          }

          if (
            url.hostname ===
            window.location.hostname
          ) {
            return;
          }

          this.track(
            "navigation",
            "external_link",
            {
              url:
                url.origin +
                url.pathname,

              hostname:
                url.hostname
            }
          );
        },
        true
      );
    }

    /**
     * ---------------------------------------------------------
     * SPA navigation
     * ---------------------------------------------------------
     */

    installHistoryTracking() {
      if (
        !window.history
      ) {
        return;
      }

      const self = this;

      if (
        this.originalPushState
      ) {
        window.history.pushState =
          function (...args) {
            const result =
              self.originalPushState.apply(
                this,
                args
              );

            self.handleRouteChange();

            return result;
          };
      }

      if (
        this.originalReplaceState
      ) {
        window.history.replaceState =
          function (...args) {
            const result =
              self.originalReplaceState.apply(
                this,
                args
              );

            self.handleRouteChange();

            return result;
          };
      }

      window.addEventListener(
        "popstate",
        () => {
          this.handleRouteChange();
        }
      );
    }

    handleRouteChange() {
      const now =
        Date.now();

      if (
        this.currentPageUrl
      ) {
        this.track(
          "page",
          "page_exit",
          {
            url:
              this.currentPageUrl,

            durationSeconds:
              Math.floor(
                (
                  now -
                  this.currentPageStartedAt
                ) / 1000
              )
          }
        );
      }

      this.currentPageUrl =
        window.location.href;

      this.currentPageStartedAt =
        now;

      this.scrollMilestones.clear();

      this.track(
        "page",
        "page_view",
        {
          pageNumber: 1
        }
      );

      this.saveCheckpoint();
    }

    /**
     * ---------------------------------------------------------
     * Error tracking
     * ---------------------------------------------------------
     */

    installErrorTracking() {
      window.addEventListener(
        "error",
        event => {
          this.track(
            "error",
            "javascript_error",
            {
              message:
                event.message ||
                null,

              filename:
                event.filename ||
                null,

              line:
                event.lineno ||
                null,

              column:
                event.colno ||
                null
            }
          );
        }
      );

      window.addEventListener(
        "unhandledrejection",
        event => {
          let reason =
            event.reason;

          if (
            reason instanceof Error
          ) {
            reason =
              reason.message;
          }

          if (
            typeof reason !==
            "string"
          ) {
            try {
              reason =
                JSON.stringify(
                  reason
                );
            } catch (error) {
              reason =
                "Unhandled promise rejection";
            }
          }

          this.track(
            "error",
            "unhandled_rejection",
            {
              reason
            }
          );
        }
      );
    }

    /**
     * ---------------------------------------------------------
     * Performance
     * ---------------------------------------------------------
     */

    trackPerformance() {
      if (
        !window.performance
      ) {
        return;
      }

      setTimeout(() => {
        try {
          const navigation =
            performance.getEntriesByType(
              "navigation"
            )[0];

          if (navigation) {
            this.track(
              "performance",
              "navigation_timing",
              {
                dns:
                  navigation.domainLookupEnd -
                  navigation.domainLookupStart,

                tcp:
                  navigation.connectEnd -
                  navigation.connectStart,

                request:
                  navigation.responseStart -
                  navigation.requestStart,

                response:
                  navigation.responseEnd -
                  navigation.responseStart,

                domInteractive:
                  navigation.domInteractive,

                domComplete:
                  navigation.domComplete,

                loadEvent:
                  navigation.loadEventEnd
              }
            );
          }
        } catch (error) {
          this.warn(
            "Performance tracking failed",
            error
          );
        }
      }, 3000);

      if (
        "PerformanceObserver" in
        window
      ) {
        try {
          const observer =
            new PerformanceObserver(
              list => {
                for (
                  const entry of list.getEntries()
                ) {
                  if (
                    entry.entryType ===
                    "largest-contentful-paint"
                  ) {
                    this.track(
                      "performance",
                      "lcp",
                      {
                        value:
                          entry.startTime
                      },
                      {
                        flush: false
                      }
                    );
                  }
                }
              }
            );

          observer.observe({
            type:
              "largest-contentful-paint",
            buffered: true
          });
        } catch (error) {}
      }
    }

    /**
     * ---------------------------------------------------------
     * Popup / custom events
     * ---------------------------------------------------------
     */

    popupOpen(
      popupId,
      popupName
    ) {
      return this.track(
        "popup",
        "popup_open",
        {
          popupId,
          popupName
        }
      );
    }

    popupClose(
      popupId,
      popupName
    ) {
      return this.track(
        "popup",
        "popup_close",
        {
          popupId,
          popupName
        }
      );
    }

    popupSubscribed(
      popupId,
      popupName
    ) {
      return this.track(
        "popup",
        "popup_subscribed",
        {
          popupId,
          popupName
        }
      );
    }

    formStart(formName) {
      return this.track(
        "form",
        "form_start",
        {
          formName:
            formName || null
        }
      );
    }

    formSubmit(formName) {
      return this.track(
        "form",
        "form_submit",
        {
          formName:
            formName || null
        }
      );
    }

    formSuccess(formName) {
      return this.track(
        "form",
        "form_success",
        {
          formName:
            formName || null
        }
      );
    }

    formError(
      formName,
      message
    ) {
      return this.track(
        "form",
        "form_error",
        {
          formName:
            formName || null,

          message:
            message || null
        }
      );
    }

    /**
     * ---------------------------------------------------------
     * End session
     * ---------------------------------------------------------
     */

    endSession(reason = "unknown") {
      if (
        this.sessionEnded
      ) {
        return;
      }

      this.sessionEnded = true;

      this.updateActivityTime();
      this.saveCheckpoint();

      const durationSeconds =
        Math.max(
          0,
          Math.floor(
            (
              Date.now() -
              this.sessionStartedAt
            ) / 1000
          )
        );

      const event =
        this.buildEvent(
          "session",
          "session_end",
          {
            reason,

            durationSeconds,

            activeSeconds:
              this.activeSeconds,

            idleSeconds:
              this.idleSeconds,

            endedAt:
              new Date().toISOString()
          }
        );

      /**
       * First put the event in IndexedDB.
       * This is async, so also try beacon immediately.
       */

      this.addEventToQueue(event)
        .catch(() => {});

      this.sendBeacon(event);
    }

    sendBeacon(event) {
      try {
        if (
          !navigator.sendBeacon
        ) {
          return false;
        }

        const blob =
          new Blob(
            [JSON.stringify(event)],
            {
              type:
                "application/json"
            }
          );

        return navigator.sendBeacon(
          this.config.endpoint,
          blob
        );
      } catch (error) {
        return false;
      }
    }

    /**
     * ---------------------------------------------------------
     * Public custom event
     * ---------------------------------------------------------
     */

    event(
      name,
      data = {}
    ) {
      return this.track(
        "custom",
        name,
        data
      );
    }

    /**
     * ---------------------------------------------------------
     * Destroy
     * ---------------------------------------------------------
     */

    destroy() {
      if (
        this.heartbeatTimer
      ) {
        clearInterval(
          this.heartbeatTimer
        );
      }

      if (
        this.checkpointTimer
      ) {
        clearInterval(
          this.checkpointTimer
        );
      }

      if (
        this.activeTimer
      ) {
        clearInterval(
          this.activeTimer
        );
      }

      const events = [
        "mousemove",
        "mousedown",
        "keydown",
        "touchstart",
        "scroll"
      ];

      if (
        this.boundHandlers.activity
      ) {
        events.forEach(
          eventName => {
            window.removeEventListener(
              eventName,
              this.boundHandlers
                .activity
            );
          }
        );
      }

      if (
        this.boundHandlers.visibility
      ) {
        document.removeEventListener(
          "visibilitychange",
          this.boundHandlers
            .visibility
        );
      }

      if (
        this.boundHandlers.online
      ) {
        window.removeEventListener(
          "online",
          this.boundHandlers.online
        );
      }

      if (
        this.boundHandlers.offline
      ) {
        window.removeEventListener(
          "offline",
          this.boundHandlers.offline
        );
      }

      if (
        this.boundHandlers.pagehide
      ) {
        window.removeEventListener(
          "pagehide",
          this.boundHandlers.pagehide
        );
      }

      this.sessionEnded = true;
    }
  }

  /**
   * -----------------------------------------------------------
   * Create global tracker
   * -----------------------------------------------------------
   */

  window.VEAnalytics =
    new VEAnalytics({
      endpoint:
        "http://localhost:3000/api/public/analytics/track",

      debug: false
    });

  /**
   * -----------------------------------------------------------
   * Start automatically
   * -----------------------------------------------------------
   */

  async function startAnalytics() {
    try {
      await window.VEAnalytics
        .openDatabase();

      await window.VEAnalytics
        .start();
    } catch (error) {
      console.error(
        "[VEAnalytics] Initialization failed:",
        error
      );
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startAnalytics,
      {
        once: true
      }
    );
  } else {
    startAnalytics();
  }
})();
