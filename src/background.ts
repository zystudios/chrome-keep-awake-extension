import { keepAlive } from "@plasmohq/persistent/background"
import { Storage } from "@plasmohq/storage"

const storage = new Storage({
  area: "local"
})

export {}

if (process.env.NODE_ENV == "production") {
  console.log = (param: any) => {}
  console.error = (param: any) => {}
  console.warn = (param: any) => {}
  console.debug = (param: any) => {}
}

// ==========================================
// 0. 記憶體快取架構（Memory Cache）
// ==========================================
const configCache = {
  auto: "false",
  sync_start_time: 0,
  refresh_cycle_start_time: 0,
  close_after: 0,
  interval: 3,
  url_monitor_list: "[]"
}

// 初始化快取：只在 Service Worker 啟動時從硬碟讀取一次
async function initCache() {
  configCache.auto = (await storage.get("auto")) || "false"
  configCache.sync_start_time =
    Number(await storage.get("sync_start_time")) || 0
  configCache.refresh_cycle_start_time =
    Number(await storage.get("refresh_cycle_start_time")) || 0
  configCache.close_after = Number(await storage.get("stop_after")) || 0
  configCache.interval = Number(await storage.get("interval")) || 3
  configCache.url_monitor_list = (await storage.get("url_monitor_list")) || "[]"

  // 初始化時也順便同步一次圖標
  updateIconState(configCache.auto)
}

// 監聽外部/前端對 storage 的直接修改，實時同步到記憶體
storage.watch({
  // 💡 在參數 c 後面加上 : any 或將 newValue 進行型別斷言，徹底擊殺 unknown 報錯
  auto: (c: any) => {
    const newVal = (c.newValue as string) || "false"
    configCache.auto = newVal
    updateIconState(newVal)
  },
  sync_start_time: (c: any) => {
    configCache.sync_start_time = Number(c.newValue) || 0
  },
  refresh_cycle_start_time: (c: any) => {
    configCache.refresh_cycle_start_time = Number(c.newValue) || 0
  },
  close_after: (c: any) => {
    configCache.close_after = Number(c.newValue) || 0
  },
  interval: (c: any) => {
    configCache.interval = Number(c.newValue) || 3
  },
  url_monitor_list: (c: any) => {
    configCache.url_monitor_list = (c.newValue as string) || "[]"
  }
})

// ==========================================
// 1. 保留您原本的頁面刷新與 Cookie 同步邏輯（完全沒變）
// ==========================================
const refreshPage = (url_list: Array<{}>) => {
  if (!url_list || url_list.length == 0) {
    return
  }

  let from_url = []
  url_list.forEach((_urlItem: any) => {
    if (from_url.indexOf(_urlItem.from) == -1 && _urlItem.select == true) {
      from_url.push(_urlItem.from)
    }
  })

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((item) => {
      if (item.url && from_url.indexOf(item.url) != -1) {
        chrome.scripting.executeScript({
          target: { tabId: item.id, allFrames: true },
          func: () => {
            window.location.reload()
          }
        })
      }
      url_list.forEach((_urlItem: any) => {
        if (
          item.url &&
          _urlItem.select == true &&
          _urlItem.to != "none" &&
          _urlItem.from == item.url
        ) {
          setTimeout(() => {
            setLocalhostCookie(_urlItem.from, _urlItem.to)
          }, 2000)
        }
      })
    })
  })
}

// 💡 獨立出無異步阻塞的圖標更新方法，不再內部反覆 await
function updateIconState(autoState: string) {
  if (autoState === "true") {
    chrome.action.setBadgeTextColor({ color: "#000000" })
    chrome.action.setBadgeText({ text: "ON" })
    chrome.action.setBadgeBackgroundColor({ color: "#1abb6b" })
  } else {
    chrome.action.setBadgeText({ text: "" })
  }
}

// 保留原有名稱供其他非同步地方調用
const showIcon = async () => {
  updateIconState(configCache.auto)
}

const setLocalhostCookie = (from: string, to: string) => {
  if (!from) {
    return
  }
  chrome.cookies.getAll(
    {
      url: from
    },
    function (cookie) {
      cookie &&
        cookie.forEach((item) => {
          chrome.cookies.set({
            url: to,
            name: item.name,
            value: item.value,
            httpOnly: item.httpOnly,
            secure: item.secure,
            expirationDate: item.expirationDate
          })
        })
    }
  )
}

// ==========================================
// 2. 核心計時邏輯（改為 100% 同步讀取快取，極速無阻塞）
// ==========================================
keepAlive()
let side_open = 0

// 啟動快取讀取
initCache()

// 核心定時器：每秒執行
setInterval(() => {
  try {
    // 💡 關鍵優化：全部改為從 configCache 同步讀取，完全移除 await storage.get
    const auto = configCache.auto
    if (auto !== "true") {
      if (side_open > 0) {
        chrome.runtime.sendMessage({
          type: "wait_for",
          value: 0,
          close_auto: 0
        })
      }
      return
    }

    const stopStartTime = configCache.sync_start_time
    const refreshStartTime = configCache.refresh_cycle_start_time
    if (!stopStartTime || !refreshStartTime) return

    const closeAfterHours = configCache.close_after
    const totalSeconds = closeAfterHours > 0 ? closeAfterHours * 3600 : 0

    const now = Date.now()

    // Stop In 計時器（獨立）
    const stopElapsedSeconds = Math.floor((now - stopStartTime) / 1000)

    // 判斷總時長是否結束
    if (totalSeconds > 0 && stopElapsedSeconds >= totalSeconds) {
      if (side_open > 0) {
        chrome.runtime.sendMessage({
          type: "wait_for",
          value: 0,
          close_auto: 0
        })
        chrome.runtime.sendMessage({ type: "close_auto" })
      }
      // 同步修改快取與永久儲存
      configCache.auto = "false"
      storage.set("auto", "false")
      return
    }

    // Refresh Interval 計時器（獨立）
    const refreshElapsedSeconds = Math.floor((now - refreshStartTime) / 1000)
    const _interval = configCache.interval
    const intervalSeconds = _interval * 60

    const next_time = refreshElapsedSeconds % intervalSeconds
    const countdownValue = intervalSeconds - next_time

    // 1. 如果 Sidepanel 打開，發送實時秒數
    if (side_open > 0) {
      const close_auto_remaining =
        totalSeconds > 0 ? totalSeconds - stopElapsedSeconds : 0
      chrome.runtime.sendMessage({
        type: "wait_for",
        value: countdownValue,
        close_auto: close_auto_remaining
      })
    }

    // 2. 當剛好符合間隔時間點，執行刷新
    if (next_time === 0 && refreshElapsedSeconds > 0) {
      const monitor_list = JSON.parse(configCache.url_monitor_list)
      if (totalSeconds > 0 && stopElapsedSeconds >= totalSeconds) {
        return
      }
      refreshPage(monitor_list)
    }
  } catch (err) {}
}, 1000)

// ==========================================
// 3. 事件監聽
// ==========================================
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("設定側邊欄失敗:", error))

// 監聽前端的重置/開始訊號
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  const now = Date.now()
  if (req.type == "auto") {
    // 異步寫入儲存，storage.onChanged 會自動幫我們更新 configCache
    storage.set("sync_start_time", now)
    storage.set("refresh_cycle_start_time", now)
    return true
  }
  if (req.type == "reset_time") {
    storage.set("refresh_cycle_start_time", now)
    return true
  }
  if (req.type == "update_close_after") {
    storage.set("stop_after", req.value)
    storage.set("sync_start_time", now)
    return true
  }
})

// 側邊欄連接狀態維護
chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "zystudios-website-cookie-sync-sidepanel") {
    side_open++
    port.onDisconnect.addListener(async () => {
      side_open--
    })
  }
})

// ==========================================
// 4. 後台備用機制：當瀏覽器完全關閉時，由 Alarm 接管監聽
// ==========================================
const ALARM_NAME = "zystudios_cookie_sync_alarm"
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    // 💡 這裡每分鐘才執行一次，直接讀取快取物件即可，極其省電
    const auto = configCache.auto
    const stopStartTime = configCache.sync_start_time
    const refreshStartTime = configCache.refresh_cycle_start_time

    if (auto === "true" && stopStartTime && refreshStartTime) {
      const now = Date.now()
      const stopElapsedSeconds = Math.floor((now - stopStartTime) / 1000)
      const refreshElapsedSeconds = Math.floor((now - refreshStartTime) / 1000)

      const _interval = configCache.interval
      const closeAfterHours = configCache.close_after
      const totalSeconds = closeAfterHours > 0 ? closeAfterHours * 3600 : 0

      if (
        (totalSeconds === 0 || stopElapsedSeconds < totalSeconds) &&
        refreshElapsedSeconds % (_interval * 60) === 0
      ) {
        const monitor_list = JSON.parse(configCache.url_monitor_list)
        refreshPage(monitor_list)
      }
    }
  }
})

chrome.alarms.get(ALARM_NAME, (alarm) => {
  if (!alarm) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 })
})
