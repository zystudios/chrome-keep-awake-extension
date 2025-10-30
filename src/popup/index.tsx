/*
 * @Author: zhangyan
 * @Date: 2025-08-23 20:35:53
 * @LastEditTime: 2025-09-08 23:24:55
 * @LastEditors: zhangyan
 * @FilePath: /demo-extension/src/popup/popup.tsx
 * @Description:
 */

import { Alert, ConfigProvider, message, Select, Spin, Switch } from "antd";
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

  const [loading, setLoading] = useState(false);
  const [awake, setAwake] = useState(false);
  const [closeAutoTime, setCloseAutoTime] = useState(0);
  const [countDownSelect, setCountDownSelect] = useState(0);
  const [bg, setBg] = useState<any>("");
  const [messageApi, contextHolder] = message.useMessage({
    top: "60px",
    duration: 2,
  });
  useEffect(() => {
    setBg(generateBg());
    const init = async () => {
      try {
        const status: string = (await storage.getItem("awake")) || "0";
        const disable: string = (await storage.getItem("disable")) || "0";
        setCountDownSelect(Number(disable));
        setAwake(status == "1" ? true : false);
        status == "1"
          ? chrome.power.requestKeepAwake("display")
          : chrome.power.releaseKeepAwake();

        chrome.runtime.onMessage.addListener(
          function (request, sender, sendResponse) {
            if (request.type === "count_down") {
              setCloseAutoTime(request.value);
              if (request.value == 0) {
                chrome.power.releaseKeepAwake();
                setCountDownSelect(0);
                setAwake(false);
              }
            }
          }
        );
      } catch {}
    };
    init();
  }, []);

  const randomNum = (min: number, max: number) => {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
  };
  //radial-gradient(shape size at position, start-color, ..., last-color); hsla(hue, saturation, lightness, alpha)
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
      <Spin fullscreen spinning={loading} size="large"></Spin>

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
          <img width={36} src={require("data-base64:../../assets/icon.png")} />
          <span
            style={{
              textAlign: "center",
              marginLeft: 5,
              backgroundImage: "linear-gradient(to right, #0090ff, #ff65ff)",
              color: "transparent",
              WebkitBackgroundClip: "text",
              fontWeight: 600,
              fontSize: 20,
            }}
          >
            Keep Awake
          </span>
        </div>

        <></>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#1abb6b",
              },
            }}
          >
            <Switch
              value={awake}
              onChange={async (v) => {
                if (v) {
                  chrome.power.requestKeepAwake("display");
                  await storage.setItem("awake", 1);
                } else {
                  chrome.power.releaseKeepAwake();
                  await storage.setItem("awake", 0);
                  setCloseAutoTime(0);
                }
                setAwake(v);
              }}
            ></Switch>
          </ConfigProvider>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginTop: 10,
              color: awake ? "#1abb6b" : "#ff4c50",
            }}
          >
            {awake ? "Keep Awake Enabled" : "Keep Awake Disabled"}
          </div>
          <div style={{ marginTop: 10, fontSize: 14 }}>
            Disable In{" "}
            <Select
              size="small"
              listHeight={130}
              value={countDownSelect}
              style={{ width: 80 }}
              options={[
                { label: "OFF", value: 0 },
                { label: "10 m", value: 10 },
                { label: "20 m", value: 20 },
                { label: "30 m", value: 30 },
                { label: "40 m", value: 40 },
                { label: "50 m", value: 50 },
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
                }
                if (awake == true) {
                  await storage.setItem("disable", e);
                  chrome.runtime.sendMessage({
                    type: "reset_time",
                  });
                }
              }}
            ></Select>
          </div>
          <Alert
            style={{ marginTop: 20 }}
            type="info"
            message={
              "Keeping the screen awake will prevent the computer from turning off or going to sleep."
            }
          ></Alert>
        </div>
      </div>
      <div
        className="footer"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <div>
          Disable In:{" "}
          <span style={{ color: "#1677ff" }}>
            {closeAutoTime == 0 ? "OFF" : convertSeconds(closeAutoTime)}
          </span>
        </div>
        <div>Ver: {appVerion}</div>
      </div>

      {contextHolder}
    </div>
  );
}

export default IndexPopup;
