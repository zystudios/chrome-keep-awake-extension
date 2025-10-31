/*
 * @Author: zhangyan
 * @Date: 2023-11-15 19:48:54
 * @LastEditTime: 2025-10-31 21:12:31
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

setInterval(async () => {
  try {
    const awake = (await storage.get("awake")) || "0";
    const disable_time = (await storage.get("disable")) || "0";

    if (awake == "1") {
      chrome.power.requestKeepAwake("display");

      if (disable_time != "0") {
        loop_count++;
        chrome.runtime.sendMessage({
          type: "count_down",
          value: Number(disable_time) * 60 - loop_count,
        });
        if (loop_count >= Number(disable_time) * 60) {
          loop_count = 0;
          chrome.power.releaseKeepAwake();
          await storage.set("awake", "0");
          await storage.set("disable", "0");
        }
      }
    }
  } catch {}
}, 1000);

// // 特别注意，默认同步，要改异步必须这么写
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type == "reset_time") {
    loop_count = 0;
    return true;
  }
});
