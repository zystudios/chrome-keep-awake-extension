/*
 * @Author: zhangyan
 * @Date: 2025-08-23 20:35:53
 * @LastEditTime: 2026-07-07 21:34:10
 * @LastEditors: zhangyan
 * @FilePath: /chrome-keep-awake-extension/src/popup/index.tsx
 * @Description: High-Performance Anti-Time-Cheating Popup
 */

import { Alert, ConfigProvider, message, Progress, Select, Switch } from "antd";
import { useEffect, useState } from "react";

import "./index.less";

import { Storage } from "@plasmohq/storage";
import { appVerion } from "~config";

const storage = new Storage({ area: "local" });

function IndexPopup() {
  if (process.env.NODE_ENV == "production") {
    window.console.log = (param: any) => {};
    window.console.error = (param: any) => {};
    window.console.warn = (param: any) => {};
    window.console.debug = (param: any) => {};
  }

  // 【優化點】用來控制初始化是否關閉動畫的狀態，防止開啟時滑塊抖動
  const [isInit, setIsInit] = useState(true);

  const [awake, setAwake] = useState(false);
  const [countDownSelect, setCountDownSelect] = useState(0);
  const [closeAutoTime, setCloseAutoTime] = useState(0);

  const [bg, setBg] = useState<any>("");
  const [messageApi, contextHolder] = message.useMessage({
    top: "60px",
    duration: 2,
  });

  const iconTxt = async (status: boolean) => {
    await chrome.action.setBadgeTextColor({ color: "#000000" });
    await chrome.action.setBadgeText({ text: status ? "ON" : "" });
    await chrome.action.setBadgeBackgroundColor({
      color: "#1abb6b",
    });
  };

  useEffect(() => {
    setBg(generateBg());
    const init = async () => {
      try {
        const status: string = (await storage.getItem("awake")) || "0";
        const disable: string = (await storage.getItem("disable")) || "0";

        setCountDownSelect(Number(disable));
        setAwake(status == "1" ? true : false);

        if (status == "1") {
          chrome.power.requestKeepAwake("display");
          await iconTxt(true);

          // 【核心修復點】初始化時直接向後台記憶體索取最精準、不怕修改系統時間的剩餘秒數
          // 瞬間對齊，完全解決時間倒退或介面閃爍問題
          chrome.runtime.sendMessage(
            { type: "get_current_remain" },
            (response) => {
              if (response && response.remain !== undefined) {
                setCloseAutoTime(response.remain);
              }
            },
          );
        } else {
          chrome.power.releaseKeepAwake();
          await iconTxt(false);
          setCloseAutoTime(0);
          setCountDownSelect(0);
        }
      } catch {
      } finally {
        // 延遲 50 毫秒恢復 Switch 動畫效果
        setTimeout(() => {
          setIsInit(false);
        }, 50);
      }
    };
    init();

    // 監聽後台每秒發來的倒數計時脈衝
    const messageListener = (request: any) => {
      if (request.type === "count_down") {
        setCloseAutoTime(request.value);

        if (request.value == 0) {
          chrome.power.releaseKeepAwake();
          iconTxt(false);
          setCountDownSelect(0);
          setAwake(false);
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const randomNum = (min: number, max: number) => {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
  };

  const generateBg = () => {
    return `radial-gradient(at ${randomNum(20, 40)}% ${randomNum(30, 80)}%, hsla(0, 100%, ${randomNum(70, 100)}%, 0.15) 0, hsla(114, 100%, 100%, 0) 40%),
            radial-gradient(at ${randomNum(50, 70)}% ${randomNum(30, 80)}%, hsla(201, 100%, ${randomNum(70, 100)}%, 0.15) 0, hsla(201, 100%, 100%, 0) 40%),        
            radial-gradient(at ${randomNum(70, 100)}% ${randomNum(30, 80)}%, hsla(112, 100%, ${randomNum(70, 100)}%, 0.15) 0, hsla(112, 100%, 100%, 0) 40%)
            `;
  };

  const convertSeconds = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) {
      return "00:00:00";
    }
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    let remainingSeconds = seconds % 60;

    return (
      (hours < 10 ? "0" + hours : hours) +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes) +
      ":" +
      (remainingSeconds < 10 ? "0" + remainingSeconds : remainingSeconds)
    );
  };

  return (
    <div
      className="layout"
      style={{
        backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBzdHlsZT0ibWFyZ2luOiBhdXRvOyBiYWNrZ3JvdW5kOiByZ2JhKDEyMiwgMjA2LCAyNTUsIDApOyBkaXNwbGF5OiBibG9jazsgei1pbmRleDogMTsgcG9zaXRpb246IHJlbGF0aXZlOyBzaGFwZS1yZW5kZXJpbmc6IGF1dG87IiB3aWR0aD0iNTAwIiBoZWlnaHQ9IjM1MCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQiIHZpZXdCb3g9IjAgMCA1MDAgMzUwIj4KPGcgdHJhbnNmb3JtPSIiPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDI4NC41MjEgNTUpIj4KICA8IS0tIPCfkqEg6Zuy5py1IDHvvJpZIOi7uOiqv+aVtOiHsyA1NSAtLT4KICA8YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InRyYW5zbGF0ZSIga2V5VGltZXM9IjA7MSIgdmFsdWVzPSItMTAwIDc1OzUwMCA3NSIgZHVyPSIzNy4wMzcwMzcwMzcwMzcwM3MiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiBiZWdpbj0iLTQuNjM1NjkwODQ1Mjk5MjU3cyIvPgogIDxwYXRoIGQ9Ik04NC43MTcsMzMuNTk3YzAuNzkxLTIuNTAzLDEuMTg2LTUuMTM4LDEuMTg2LTcuNzczQzg1LjkwMywxMS41OTQsNzQuMzA4LDAsNjAuMDc5LDAgYy05Ljg4MSwwLTE4LjQ0NSw1LjUzNC0yMi43OTMsMTMuNzAyYy0xLjU4MS0wLjUyNy0zLjQyNi0wLjc5MS01LjEzOC0wLjc5MWMtOS40ODYsMC0xNy4xMjgsNy42NDItMTcuMTI4LDE3LjEyOCBjMCwxLjE4NiwwLjEzMiwyLjM3MiwwLjM5NSwzLjQyNkM2LjcxOSwzNC43ODMsMCw0Mi40MjQsMCw1MS41MTVDMCw2MS42Niw4LjE2OSw2OS44MjksMTguMzE0LDY5LjgyOWg2My4zNzMgQzkxLjgzMSw2OS44MjksMTAwLDYxLjY2LDEwMCw1MS41MTVDOTkuODY4LDQyLjU1Niw5My4yODEsMzUuMDQ2LDg0LjcxNywzMy41OTd6IiBmaWxsPSIjOThlOWZmNzciIHRyYW5zZm9ybT0ic2NhbGUoMC4zMykiLz4KPC9nPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQ1OS40MjggMTUpIj4KICA8IS0tIPCfkqEg6Zuy5py1IDLvvJpZIOi7uOiqv+aVtOiHsyAxNSAtLT4KICA8YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InRyYW5zbGF0ZSIga2V5VGltZXM9IjA7MSIgdmFsdWVzPSItMTAwIDEzNTs1MDAgMTM1IiBkdXI9IjM3LjAzNzAzNzAzNzAzNzAzcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIGJlZ2luPSItMTUuNDMyNDM3NTc0MTI1NzFzIi8+CiAgPHBhdGggZD0iTTg0LjcxNywzMy41OTdjMC43OTEtMi41MDMsMS4xODYtNS4xMzgsMS4xODYtNy43NzNDODUuOTAzLDExLjU5NCw3NC4zMDgsMCw2MC4wNzksMCBjLTkuODgxLDAtMTguNDQ1LDUuNTM0LTIyLjc5MywxMy43MDJjLTEuNTgxLTAuNTI3LTMuNDI2LTAuNzkxLTUuMTM4LTAuNzkxYy05LjQ4NiwwLTE3LjEyOCw3LjY0Mi0xNy4xMjgsMTcuMTI4IGMwLDEuMTg2LDAuMTMyLDIuMzcyLDAuMzk1LDMuNDI2QzYuNzE5LDM0Ljc4MywwLDQyLjQyNCwwLDUxLjUxNUMwLDYxLjY2LDguMTY5LDY5LjgyOSwxOC4zMTQsNjkuODI5aDYzLjM3MyBDOTEuODMxLDY5LjgyOSwxMDAsNjEuNjYsMTAwLDUxLjUxNUM5OS44NjgsNDIuNTU2LDkzLjI4MSwzNS4wNDYsODQuNzE3LDMzLjU5N3oiIGZpbGw9IiNjMmYxZmY3NyIgdHJhbnNmb3JtPSJzY2FsZSgwLjMzKSIvPgo8L2c+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTUuMDQyOSAyNDApIj4KICA8IS0tIPCfkqEg6Zuy5py1IDPvvJpZIOi7uOiqv+aVtOiHsyAyNDAgLS0+CiAgPGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIiB0eXBlPSJ0cmFuc2xhdGUiIGtleVRpbWVzPSIwOzEiIHZhbHVlcz0iLTEwMCAyNDA7NTAwIDI3MCIgZHVyPSIxOC41MTg1MTg1MTg1MTg1MTVzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIgYmVnaW49Ii0yLjk2OTA1MzI0OTQ5MTg2OHMiLz4KICA8cGF0aCBkPSJNODQuNzE3LDMzLjU5N2MwLjc5MS0yLjUwMywxLjE4Ni01LjEzOCwxLjE4Ni03Ljc3M0M4NS45MDMsMTEuNTk0LDc0LjMwOCwwLDYwLjA3OSwwIGMtOS44ODEsMC0xOC40NDUsNS41MzQtMjIuNzkzLDEzLjcwMmMtMS41ODEtMC41MjctMy40MjYtMC43OTEtNS4xMzgtMC43OTFjLTkuNDg2LDAtMTcuMTI4LDcuNjQyLTE3LjEyOCwxNy4xMjggYzAsMS4xODYsMC4xMzIsMi4zNzIsMC4zOTUsMy40MjZDNi43MTksMzQuNzgzLDAsNDIuNDI0LDAsNTEuNTE1QzAsNjEuNjYsOC4xNjksNjkuODI5LDE4LjMxNCw2OS44MjloNjMuMzczIEM5MS44MzEsNjkuODI5LDEwMCw2MS42NiwxMDAsNTEuNTE1Qzk5Ljg2OCw0Mi41NTYsOTMuMjgxLDM1LjA0Niw4NC43MTcsMzMuNTk3eiIgZmlsbD0iI2MyZjFmZjc3IiB0cmFuc2Zvcm09InNjYWxlKDAuMzIpIi8+CjwvZz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyNDQuNzEzIDQ1KSI+CiAgPCEtLSDwn5KhIOmbsuactSA177yaWSDou7joqr/mlbToh7MgNDUgLS0+CiAgPGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIiB0eXBlPSJ0cmFuc2xhdGUiIGtleVRpbWVzPSIwOzEiIHZhbHVlcz0iLTEwMCA0NTs1MDAgNDUiIGR1cj0iMTIuMzQ1Njc5MDEyMzQ1Njc3cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIGJlZ2luPSItMC4zMzgzNzc2ODgyODg3OTA5NXMiLz4KICA8cGF0aCBkPSJNODQuNzE3LDMzLjU5N2MwLjc5MS0yLjUwMywxLjE4Ni01LjEzOCwxLjE4Ni03Ljc3M0M4NS45MDMsMTEuNTk0LDc0LjMwOCwwLDYwLjA3OSwwIGMtOS44ODEsMC0xOC40NDUsNS41MzQtMjIuNzkzLDEzLjcwMmMtMS41ODEtMC41MjctMy40MjYtMC43OTEtNS4xMzgtMC43OTFjLTkuNDg2LDAtMTcuMTI4LDcuNjQyLTE3LjEyOCwxNy4xMjggYzAsMS4xODYsMC4xMzIsMi4zNzIsMC4zOTUsMy40MjZDNi43MTksMzQuNzgzLDAsNDIuNDI0LDAsNTEuNTE1QzAsNjEuNjYsOC4xNjksNjkuODI5LDE4LjMxNCw2OS44MjloNjMuMzczIEM5MS44MzEsNjkuODI5LDEwMCw2MS42NiwxMDAsNTEuNTE1Qzk5Ljg2OCw0Mi41NTYsOTMuMjgxLDM1LjA0Niw4NC43MTcsMzMuNTk3eiIgZmlsbD0iI2MyZjFmZjc3IiB0cmFuc2Zvcm09InNjYWxlKDAuMzEpIi8+CjwvZz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg0MDQuMDQ1IDE3MCkiPgogIDwhLS0g8J+SoSDpm7LmnLUgNu+8mlkg6Lu46Kq/5pW06IezIDE3MCAtLT4KICA8YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InRyYW5zbGF0ZSIga2V5VGltZXM9IjA7MSIgdmFsdWVzPSItMTAwIDE5MDs1MDAgMTkwIiBkdXI9IjEyLjM0NTY3OTAxMjM0NTY3N3MiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiBiZWdpbj0iLTI4LjMwODE2MzYwNjA3MDgzNXMiLz4KICA8cGF0aCBkPSJNODQuNzE3LDMzLjU5N2MwLjc5MS0yLjUwMywxLjE4Ni01LjEzOCwxLjE4Ni03Ljc3M0M4NS45MDMsMTEuNTk0LDc0LjMwOCwwLDYwLjA3OSwwIGMtOS44ODEsMC0xOC40NDUsNS41MzQtMjIuNzkzLDEzLjcwMmMtMS41ODEtMC41MjctMy40MjYtMC43OTEtNS4xMzgtMC43OTFjLTkuNDg2LDAtMTcuMTI4LDcuNjQyLTE3LjEyOCwxNy4xMjggYzAsMS4xODYsMC4xMzIsMi4zNzIsMC4zOTUsMy40MjZDNi43MTksMzQuNzgzLDAsNDIuNDI0LDAsNTEuNTE1QzAsNjEuNjYsOC4xNjksNjkuODI5LDE4LjMxNCw2OS44MjloNjMuMzczIEM5MS44MzEsNjkuODI5LDEwMCw2MS42NiwxMDAsNTEuNTE1Qzk5Ljg2OCw0Mi41NTYsOTMuMjgxLDM1LjA0Niw4NC43MTcsMzMuNTk3eiIgZmlsbD0iI2MyZjFmZjc3IiB0cmFuc2Zvcm09InNjYWxlKDAuNDEpIi8+CjwvZz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg0MDYuMjggMjUpIj4KICA8IS0tIPCfkqEg6Zuy5py1IDfvvJpZIOi7uOiqv+aVtOiHsyAyNSAtLT4KICA8YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InRyYW5zbGF0ZSIga2V5VGltZXM9IjA7MSIgdmFsdWVzPSItMTAwIDU7NTAwIDUiIGR1cj0iOS4yNTkyNTkyNTkyNTkyNThzIiByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIgYmVnaW49Ii0xNi40OTA1NjgyMTQyMjA5MzJzIi8+CiAgPHBhdGggZD0iTTg0LjcxNywzMy41OTdjMC43OTEtMi41MDMsMS4xODYtNS4xMzgsMS4xODYtNy43NzNDODUuOTAzLDExLjU5NCw3NC4zMDgsMCw2MC4wNzksMCBjLTkuODgxLDAtMTguNDQ1LDUuNTM0LTIyLjc5MywxMy43MDJjLTEuNTgxLTAuNTI3LTMuNDI2LTAuNzkxLTUuMTM4LTAuNzkxYy05LjQ4NiwwLTE3LjEyOCw3LjY0Mi0xNy4xMjgsMTcuMTI4IGMwLDEuMTg2LDAuMTMyLDIuMzcyLDAuMzk1LDMuNDI2QzYuNzE5LDM0Ljc4MywwLDQyLjQyNCwwLDUxLjUxNUMwLDYxLjY2LDguMTY5LDY5LjgyOSwxOC4zMTQsNjkuODI5aDYzLjM3MyBDOTEuODMxLDY5LjgyOSwxMDAsNjEuNjYsMTAwLDUxLjUxNUM5OS44NjgsNDIuNTU2LDkzLjI4MSwzNS4wNDYsODQuNzE3LDMzLjU5N3oiIGZpbGw9IiNjMmYxZmY3NyIgdHJhbnNmb3JtPSJzY2FsZSgwLjI0KSIvPgo8L2c+PC9nPgo8L3N2Zz4K")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <div
        className="content"
        style={{
          backgroundColor: "#ffffff00",
          backgroundImage: bg,
        }}
      >
        {/* <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img width={36} src={require("data-base64:../../assets/logo.png")} />
          <span
            style={{
              textAlign: "center",
              marginLeft: 10,
              backgroundImage: "linear-gradient(to right, #0090ff, #ff65ff)",
              color: "transparent",
              WebkitBackgroundClip: "text",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            Keep Awake
          </span>
        </div> */}

        <></>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <Progress
            type="dashboard"
            gapDegree={80}
            percent={
              awake && closeAutoTime === 0
                ? 100
                : !awake
                  ? 0
                  : // ✨【终极优雅修复】：如果当前倒计时秒数跟刚刚选择的总时间对不上（代表正在切换的瞬间），直接强制 100%
                    closeAutoTime >= countDownSelect * 60
                    ? 100
                    : (closeAutoTime / (countDownSelect * 60)) * 100
            }
            size={155}
            strokeWidth={9}
            strokeLinecap="butt"
            strokeColor={
              awake == false
                ? "#eef0ee"
                : {
                    "0%": "#ff6b6b", // 🟥 红色起点
                    "25%": "#ffd166", // 🟨 黄色断点（红黄区间占 25%）
                    "50%": "#06d6a0", // 🟩 绿色起点（黄绿过渡占 25%）
                    "100%": "#06d6a0", // 🟩 绿色终点（后半段 50% 全部保持纯绿色）
                  }
            }
            format={() => (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center", // 💡 核心修正：讓整串倒計時數字在網頁上「水平居中」
                    alignItems: "center", // 💡 核心修正：讓數字和冒號在「上下垂直居中」對齊
                    color: "#1677ff",
                    fontSize: 20,
                    fontWeight: 500,
                    marginTop: "10px",
                    fontVariantNumeric: "tabular-nums",
                    width: "100%", // 確保佔滿父容器寬度，以便完美居中
                  }}
                >
                  {(closeAutoTime === 0
                    ? "00:00:00"
                    : convertSeconds(closeAutoTime)
                  )
                    .split("")
                    .map((char, index) => {
                      const isColon = char === ":" || char === "：";
                      return (
                        <span
                          key={index}
                          style={{
                            fontFamily: isColon ? "Courier" : '"digitNum"',
                            width: isColon ? "10px" : "12px",
                            textAlign: "center", // 💡 確保每個單獨的數字在自己的格子裡水平居中
                            display: "inline-block",
                            // 💡 如果你發現冒號偏上或偏下，可以透過微調下面這行 lineHegiht 或 padding 來微調上下對齊：
                            lineHeight: "20px",
                          }}
                        >
                          {char}
                        </span>
                      );
                    })}
                </div>
                <ConfigProvider
                  theme={{
                    token: {
                      colorPrimary: "#1abb6b",
                    },
                  }}
                >
                  <Switch
                    style={{ marginTop: 20 }}
                    className={isInit ? "popup-init-no-anime" : ""}
                    value={awake}
                    onChange={async (v) => {
                      if (v) {
                        // 1. 啟動常亮
                        chrome.power.requestKeepAwake("display");
                        setCountDownSelect(0);

                        // 2. 更新全域 storage 磁碟數據
                        await storage.setItem("disable", 0);
                        await storage.setItem("awake", "1");
                        await iconTxt(true);

                        // 3. 同步打包狀態通知後台被動更新記憶體變數
                        chrome.runtime.sendMessage({
                          type: "reset_time",
                          awake: "1",
                          disable: 0,
                        });
                      } else {
                        // 1. 釋放常亮
                        chrome.power.releaseKeepAwake();

                        // 2. 清空並還原前台所有狀態（徹底移除無用的 target_time 持久化）
                        await storage.setItem("awake", "0");
                        await storage.setItem("disable", 0);
                        setCloseAutoTime(0);
                        setCountDownSelect(0);
                        await iconTxt(false);

                        // 3. 同步打包狀態通知後台記憶體變數關閉
                        chrome.runtime.sendMessage({
                          type: "reset_time",
                          awake: "0",
                          disable: 0,
                        });
                      }
                      setAwake(v);
                    }}
                  ></Switch>
                </ConfigProvider>
              </div>
            )}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginTop: 0,
              color: awake ? "#1abb6b" : "#ff4c50",
            }}
          >
            {awake
              ? chrome.i18n.getMessage("enabled")
              : chrome.i18n.getMessage("disabled")}
          </div>
          <div
            style={{
              marginTop: 15,
              fontSize: 14,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {chrome.i18n.getMessage("disableIn")}
            <Select
              size="small"
              listHeight={160}
              value={countDownSelect}
              style={{ width: 85 }}
              options={
                [
                  { label: "OFF", value: 0 },
                  process.env.NODE_ENV == "development" && {
                    label: "1 min",
                    value: 1,
                  },
                  { label: "10 min", value: 10 },
                  { label: "20 min", value: 20 },
                  { label: "30 min", value: 30 },
                  { label: "40 min", value: 40 },
                  { label: "50 min", value: 50 },
                  { label: "1 h", value: 60 },
                  { label: "1.5 h", value: 90 },
                  { label: "2 h", value: 120 },
                  { label: "2.5 h", value: 150 },
                  { label: "3 h", value: 180 },
                  { label: "3.5 h", value: 210 },
                  { label: "4 h", value: 240 },
                  { label: "4.5 h", value: 270 },
                  { label: "5 h", value: 300 },
                  { label: "5.5 h", value: 330 },
                  { label: "6 h", value: 360 },
                  { label: "6.5 h", value: 390 },
                  { label: "7 h", value: 420 },
                  { label: "7.5 h", value: 450 },
                  { label: "8 h", value: 480 },
                  { label: "8.5 h", value: 510 },
                  { label: "9 h", value: 540 },
                  { label: "9.5 h", value: 570 },
                  { label: "10 h", value: 600 },
                  { label: "10.5 h", value: 630 },
                  { label: "11 h", value: 660 },
                  { label: "11.5 h", value: 690 },
                  { label: "12 h", value: 720 },
                ].filter(Boolean) as any
              } // 过滤掉开发环境判断可能引入的 false 假值，确保生产环境稳定渲染
              onChange={async (e) => {
                // 1. 更新下拉框渲染状态
                setCountDownSelect(e);

                // 2. 预设下一个要同步给后台的常亮状态

                // 3. 如果用户主动选了 OFF (0)
                if (e > 0) {
                  setCloseAutoTime(e * 60); // 比如选了 60 分钟，立刻前台设为 3600 秒，这样百分比瞬间就是 3600/3600 = 100%
                } else {
                  setCloseAutoTime(0);
                }

                let nextAwake = awake ? "1" : "0";

                // 4. 只要选择的时间大于 0，且当前开关处于关闭状态，自动级联激活常亮
                if (e > 0 && !awake) {
                  setAwake(true);
                  nextAwake = "1";
                  chrome.power.requestKeepAwake("display");
                  await storage.setItem("awake", "1");
                  await iconTxt(true);
                }

                // 5. 将最新的倒计时选择分钟数持久化同步到全局 storage
                await storage.setItem("disable", e);

                // 6. 把最新的常亮开关状态和倒计时分钟数打包发送，被动刷新后台内存
                chrome.runtime.sendMessage({
                  type: "reset_time",
                  awake: nextAwake,
                  disable: e,
                });
              }}
            ></Select>
          </div>
          <Alert
            style={{
              margin: "20px 5px 40px 5px",

              textAlign: "left",
              padding: "8px 12px",
              wordBreak: "break-word",
              maxHeight: 160,
              overflowY: "auto",
            }}
            type="info"
            message={chrome.i18n.getMessage("alertMessage")}
          />
        </div>
      </div>
      <div
        className="footer"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <div
          style={{
            display: "inline-flex", // 💡 改為 inline-flex，更適合導航列或標題的緊湊對齊
            alignItems: "center", // 💡 確保 flex 子項垂直居中
            justifyContent: "center", // 💡 確保水平居中
            gap: "6px", // 稍微拉開一點圖標與文字的間距，視覺更和諧
            height: "24px", // 💡 固定的高度可以給內部元素一個精準的對齊基準線
          }}
        >
          <img
            width={16}
            height={16} // 💡 明確限制高度，防止圖片比例拉伸
            src={require("data-base64:../../assets/icon.png")}
            style={{
              display: "block",
              flexShrink: 0, // 💡 防止圖片在小容器中被擠壓變形
            }}
          />
          <span
            style={{
              fontSize: "14px", // 根據你的設計調整字號
              lineHeight: "16px", // 💡 極其重要：將文字行高設定為與圖片高度（16px）完全一致，徹底根治「底部對齊」的頑疾
              display: "inline-block",
            }}
          >
            Keep Awake
          </span>
        </div>
        <div>v{appVerion}</div>
      </div>

      {contextHolder}
    </div>
  );
}

export default IndexPopup;
