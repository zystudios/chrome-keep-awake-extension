/*
 * @Author: zhangyan
 * @Date: 2025-08-23 20:35:53
 * @LastEditTime: 2026-07-06 00:03:21
 * @LastEditors: zhangyan
 * @FilePath: /chrome-keep-awake-extension/src/popup/index.tsx
 * @Description:
 */

import { Alert, ConfigProvider, message, Select, Spin, Switch } from "antd";
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

  // 【核心修改点】用来控制初始化是否关闭动画的状态
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
        const targetTimeStr: string =
          (await storage.getItem("target_time")) || "0";

        setCountDownSelect(Number(disable));
        setAwake(status == "1" ? true : false);

        if (status == "1") {
          chrome.power.requestKeepAwake("display");
          await iconTxt(true);

          const targetTime = Number(targetTimeStr);
          if (targetTime > 0) {
            const remain = Math.max(
              0,
              Math.round((targetTime - Date.now()) / 1000)
            );
            setCloseAutoTime(remain);
          }
        } else {
          chrome.power.releaseKeepAwake();
          await iconTxt(false);
          setCloseAutoTime(0);
          setCountDownSelect(0);
        }
      } catch {
      } finally {
        setTimeout(() => {
          setIsInit(false);
        }, 50);
      }
    };
    init();

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
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#1abb6b",
              },
            }}
          >
            <Switch
              // 【核心修改点】根据当前是否是初始化状态，动态赋予无动画类名
              className={isInit ? "popup-init-no-anime" : ""}
              value={awake}
              onChange={async (v) => {
                if (v) {
                  chrome.power.requestKeepAwake("display");
                  setCountDownSelect(0);
                  await storage.setItem("disable", 0);
                  await storage.setItem("awake", "1");
                  await iconTxt(true);
                } else {
                  chrome.power.releaseKeepAwake();
                  await storage.setItem("awake", "0");
                  await storage.setItem("disable", 0);
                  await storage.setItem("target_time", 0);
                  setCloseAutoTime(0);
                  setCountDownSelect(0);
                  await iconTxt(false);
                }
                setAwake(v);
              }}
            ></Switch>
          </ConfigProvider>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginTop: 20,
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
              listHeight={130}
              value={countDownSelect}
              style={{ width: 85 }}
              options={[
                { label: "OFF", value: 0 },
                //{ label: "1 min", value: 1 },
                { label: "10 min", value: 10 },
                { label: "20 min", value: 20 },
                { label: "30 min", value: 30 },
                { label: "40 min", value: 40 },
                { label: "50 min", value: 50 },
                { label: "1 h", value: 60 },
                { label: "2 h", value: 120 },
                { label: "3 h", value: 180 },
                { label: "4 h", value: 240 },
                { label: "5 h", value: 300 },
                { label: "6 h", value: 360 },
                { label: "7 h", value: 420 },
                { label: "8 h", value: 480 },
                { label: "9 h", value: 540 },
                { label: "10 h", value: 600 },
                { label: "11 h", value: 660 },
                { label: "12 h", value: 720 },
              ]}
              onChange={async (e) => {
                setCountDownSelect(e);

                if (e == 0) {
                  setCloseAutoTime(0);
                  await storage.setItem("target_time", 0);
                }

                if (e > 0 && !awake) {
                  setAwake(true);
                  chrome.power.requestKeepAwake("display");
                  await storage.setItem("awake", "1");
                  await iconTxt(true);
                }

                await storage.setItem("disable", e);

                if (awake || e > 0) {
                  chrome.runtime.sendMessage({
                    type: "reset_time",
                  });
                }
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
        <div>
          <ClockCircleOutlined />{" "}
          <span style={{ color: "#1677ff" }}>
            {closeAutoTime == 0 ? "OFF" : convertSeconds(closeAutoTime)}
          </span>
        </div>
        <div>v{appVerion}</div>
      </div>

      {contextHolder}
    </div>
  );
}

export default IndexPopup;
