/*
 * @Author: zhangyan
 * @Date: 2025-08-23 20:35:53
 * @LastEditTime: 2026-07-06 00:42:50
 * @LastEditors: zhangyan
 * @FilePath: /chrome-keep-awake-extension/src/popup/index.tsx
 * @Description: High-Performance Anti-Time-Cheating Popup
 */

import {
  Alert,
  ConfigProvider,
  message,
  Progress,
  Select,
  Spin,
  Switch,
} from "antd";
import { useEffect, useState } from "react";

import "./index.less";

import { Storage } from "@plasmohq/storage";
import { appVerion } from "~config";
import { ClockCircleOutlined } from "@ant-design/icons";

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
    return `radial-gradient(at ${randomNum(20, 40)}% ${randomNum(30, 80)}%, hsla(0, 100%, ${randomNum(70, 100)}%, 0.1) 0, hsla(114, 100%, 100%, 0) 40%),
            radial-gradient(at ${randomNum(50, 70)}% ${randomNum(30, 80)}%, hsla(201, 100%, ${randomNum(70, 100)}%, 0.1) 0, hsla(201, 100%, 100%, 0) 40%),        
            radial-gradient(at ${randomNum(70, 100)}% ${randomNum(30, 80)}%, hsla(112, 100%, ${randomNum(70, 100)}%, 0.1) 0, hsla(112, 100%, 100%, 0) 40%)
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
    <div className="layout">
      <div
        className="content"
        style={{
          backgroundColor: "#fff",
          backgroundImage: bg,
        }}
      >
        <div
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
        </div>

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
                  : (closeAutoTime / (countDownSelect * 60)) * 100
            }
            size={150}
            strokeWidth={8}
            strokeColor={awake == false ? "#eef0ee" : "#1abb6b"}
            format={() => (
              <div>
                <div
                  style={{
                    color: "#1677ff",
                    fontSize: 20,
                    fontWeight: 500,
                    margin: "5px 0",
                  }}
                >
                  {closeAutoTime == 0
                    ? "00:00:00"
                    : convertSeconds(closeAutoTime)}
                </div>
                <ConfigProvider
                  theme={{
                    token: {
                      colorPrimary: "#1abb6b",
                    },
                  }}
                >
                  <Switch
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
                let nextAwake = awake ? "1" : "0";

                // 3. 如果用户主动选了 OFF (0)
                if (e == 0) {
                  setCloseAutoTime(0);
                }

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
        <div></div>
        <div>v{appVerion}</div>
      </div>

      {contextHolder}
    </div>
  );
}

export default IndexPopup;
