/*
 * @Author: zhangyan
 * @Date: 2023-11-15 19:48:54
 * @LastEditTime: 2026-07-06 00:18:27
 * @LastEditors: zhangyan
 * @FilePath: /chrome-keep-awake-extension/src/background.ts
 * @Description: Keep Awake Extension Background Service Worker
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

// ==========================================
// 核心高性能重构：引入后台专用局域内存缓存变量
// ==========================================
let localAwake = "0"; // 内存缓存：当前常亮状态
let localDisable = 0; // 内存缓存：当前设定的倒计时分钟数
let localTargetTime = 0; // 内存缓存：未来的绝对截止时间戳
let isInitialized = false; // 内存状态：是否已完成首次磁盘数据同步

const showIcon = async () => {
  const awake = (await storage.get("awake")) || "0";
  if (awake == "1") {
    await chrome.action.setBadgeTextColor({ color: "#000000" });
    await chrome.action.setBadgeText({ text: "ON" });
    await chrome.action.setBadgeBackgroundColor({
      color: "#1abb6b",
    });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
};

// 抽取清理/关闭常亮任务的公共方法
const releaseAwakeTask = async () => {
  chrome.power.releaseKeepAwake();

  // 1. 同步清空后台本地内存
  localAwake = "0";
  localDisable = 0;
  localTargetTime = 0;

  // 2. 写入全局共享的 storage 磁盘空间，确保下次打开 Popup 时数据也是最新的
  await storage.set("awake", "0");
  await storage.set("disable", 0);
  await storage.set("target_time", 0);
  await chrome.action.setBadgeText({ text: "" });

  // 3. 实时通知当前可能正开着的前台弹窗
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
    const targetTimeStr = (await storage.get("target_time")) || "0";
    localTargetTime = Number(targetTimeStr);
  } catch (err) {
    console.error("Background initialization failed:", err);
  } finally {
    isInitialized = true; // 标记内存已准备就绪
  }
};

initBackground();

// 高频定时器：彻底抛弃高成本的磁盘 I/O，改用超快、零内耗的纯内存变量比对
setInterval(async () => {
  try {
    // 如果内存数据还没从 storage 初始化加载完，先跳过本次循环
    if (!isInitialized) return;

    // 纯内存判断常亮开关
    if (localAwake == "1") {
      chrome.power.requestKeepAwake("display");

      // 纯内存判断是否设置了倒计时
      if (localTargetTime > 0) {
        const now = Date.now();

        // 用绝对截止时间戳，精准算出剩余的总秒数
        const remainSeconds = Math.max(
          0,
          Math.round((localTargetTime - now) / 1000)
        );

        // 每一秒通过脉冲消息传递给前台 Popup 实时刷新渲染
        chrome.runtime.sendMessage({
          type: "count_down",
          value: remainSeconds,
        });

        // 倒计时归零，触发释放清理
        if (remainSeconds <= 0) {
          await releaseAwakeTask();
        }
      }
    }
  } catch {}
}, 1000);

// 消息监听器：接收 Popup 实时发来的最新状态包裹，以此被动刷新后台内存
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type == "reset_time") {
    // 1. 直接拦截并同步更新内存中的常亮状态与倒计时时长
    localAwake = req.awake ?? localAwake;
    localDisable = Number(req.disable ?? localDisable);

    // 2. 只有当倒计时大于 0 时，才利用当前时间戳实时衍生出未来的绝对截止时间
    if (localDisable > 0) {
      localTargetTime = Date.now() + localDisable * 60 * 1000;
      storage.set("target_time", localTargetTime); // 辅助备份到磁盘，用于 Popup 打开时直接无缝防闪烁对齐
    } else {
      localTargetTime = 0;
      storage.set("target_time", 0);
    }
    return true;
  }
});
