/*
 * @Author: zhangyan
 * @Date: 2023-11-15 19:48:54
 * @LastEditTime: 2026-07-05 23:51:41
 * @LastEditors: zhangyan
 * @FilePath: /chrome-keep-awake-extension/src/background.ts
 * @Description:
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
let loop_count = 0;

const showIcon = async () => {
  const awake = (await storage.get("awake")) || "0";
  if (awake == "1") {
    await chrome.action.setBadgeTextColor({ color: "#000000" });
    await chrome.action.setBadgeText({ text: "ON" });
    await chrome.action.setBadgeBackgroundColor({
      color: "#1abb6b",
    });
  }
};

showIcon();

// 提取重置未来绝对截止时间戳的方法
const updateTargetTime = async () => {
  const disable_time = (await storage.get("disable")) || "0";
  if (disable_time != "0") {
    const target = Date.now() + Number(disable_time) * 60 * 1000;
    await storage.set("target_time", target);
  } else {
    await storage.set("target_time", 0);
  }
};

setInterval(async () => {
  try {
    const awake = (await storage.get("awake")) || "0";
    const disable_time = (await storage.get("disable")) || "0";

    if (awake == "1") {
      chrome.power.requestKeepAwake("display");

      if (disable_time != "0") {
        loop_count++;

        // 实时推送最新剩余秒数给前台 UI 渲染
        chrome.runtime.sendMessage({
          type: "count_down",
          value: Number(disable_time) * 60 - loop_count,
        });

        if (loop_count >= Number(disable_time) * 60) {
          loop_count = 0;
          chrome.power.releaseKeepAwake();

          // 纯全局 Storage：直接在这里更新状态，下次 Popup 打开看到的就是最新的
          await storage.set("awake", "0");
          await storage.set("disable", 0);
          await storage.set("target_time", 0);
          await chrome.action.setBadgeText({ text: "" });

          // 确保当时开着的前台弹窗也能同步变回 OFF 状态
          chrome.runtime.sendMessage({
            type: "count_down",
            value: 0,
          });
        }
      }
    }
  } catch {}
}, 1000);

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type == "reset_time") {
    loop_count = 0;
    updateTargetTime();
    return true;
  }
});
