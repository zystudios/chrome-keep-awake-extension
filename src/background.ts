/*
 * @Author: zhangyan
 * @Date: 2023-11-15 19:48:54
 * @LastEditTime: 2026-08-06 20:21:02
 * @LastEditors: zhangyan
 * @FilePath: /chrome-keep-awake-extension/src/background.ts
 * @Description: Ultimate High-Performance Anti-Eviction Background (Chrome Alarms Version)
 */

import { keepAlive } from "@plasmohq/persistent/background";
import { Storage } from "@plasmohq/storage";

const storage = new Storage({
  area: "local",
});

export {};

if (process.env.NODE_ENV == "production") {
  console.log = (param: any) => {};
  console.error = (param: any) => {};
  console.warn = (param: any) => {};
  console.debug = (param: any) => {};
}

keepAlive();

// 定时器唯一标识名
const ALARM_NAME = "keep_awake_timer";

let localAwake = "0";
let localDisable = 0;
let isInitialized = false;

const showIcon = async () => {
  const awake = (await storage.get("awake")) || "0";
  if (awake == "1") {
    await chrome.action.setBadgeTextColor({ color: "#000000" });
    await chrome.action.setBadgeText({ text: "ON" });
    await chrome.action.setBadgeBackgroundColor({ color: "#1abb6b" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
};

// 抽取清理/关闭常亮任务的公共方法
const releaseAwakeTask = async () => {
  chrome.power.releaseKeepAwake();
  await chrome.alarms.clear(ALARM_NAME); // 清理内核级定时器

  localAwake = "0";
  localDisable = 0;

  await storage.set("awake", "0");
  await storage.set("disable", 0);
  await chrome.action.setBadgeText({ text: "" });

  // 通知可能正开着的前台弹窗
  chrome.runtime.sendMessage({
    type: "count_down",
    value: 0,
  });
};

// 初始化方法：只在 Service Worker 首次加载/被唤醒时读取一次磁盘，注入内存
const initBackground = async () => {
  try {
    await showIcon();
    localAwake = (await storage.get("awake")) || "0";
    localDisable = Number(await storage.get("disable")) || 0;
  } catch (err) {
    console.error("Background initialization failed:", err);
  } finally {
    isInitialized = true;
  }
};

initBackground();

// 【高频通知心跳】只负责给开着的 Popup 广播剩余秒数，不进行核心逻辑计算（0 磁盘写入）
setInterval(async () => {
  try {
    if (!isInitialized) return;

    if (localAwake == "1") {
      chrome.power.requestKeepAwake("display");

      if (localDisable > 0) {
        // 直接从内核获取定时器状态，高效率且 100% 精准
        const alarm = await chrome.alarms.get(ALARM_NAME);
        if (alarm) {
          const now = Date.now();
          const remainSeconds = Math.max(
            0,
            Math.round((alarm.scheduledTime - now) / 1000)
          );

          chrome.runtime.sendMessage({
            type: "count_down",
            value: remainSeconds,
          });
        }
      }
    }
  } catch {}
}, 1000);

// 【核心修复：内核级报警器触发监听】
// 无论后台 Service Worker 有没有休眠，时间一到，浏览器内核百分之百强行唤醒该事件，稳稳执行关闭！
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await releaseAwakeTask();
  }
});

// 消息监听器：接收 Popup 实时发来的最新状态包裹
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type == "reset_time") {
    localAwake = req.awake ?? localAwake;
    localDisable = Number(req.disable ?? localDisable);

    if (localDisable > 0) {
      // 核心修改点：丢弃性能极差的磁盘写入和不稳定的计算，直接注册一个内核级闹钟任务 [1]
      chrome.alarms.create(ALARM_NAME, { delayInMinutes: localDisable });
    } else {
      chrome.alarms.clear(ALARM_NAME);
    }
    return true;
  }

  // 【新增监听接口】供前端 Popup 在打开时一瞬间索取内存中最实时、不闪烁的剩余秒数
  if (req.type == "get_current_remain") {
    chrome.alarms
      .get(ALARM_NAME)
      .then((alarm) => {
        if (alarm) {
          const remain = Math.max(
            0,
            Math.round((alarm.scheduledTime - Date.now()) / 1000)
          );
          sendResponse({ remain });
        } else {
          sendResponse({ remain: 0 });
        }
      })
      .catch(() => {
        sendResponse({ remain: 0 });
      });
    return true; // 必须返回 true 以保证异步 sendResponse 有效
  }
});
