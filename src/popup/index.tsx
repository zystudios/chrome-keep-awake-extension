/*
 * @Author: zhangyan
 * @Date: 2025-08-23 20:35:53
 * @LastEditTime: 2025-09-08 23:24:55
 * @LastEditors: zhangyan
 * @FilePath: /demo-extension/src/popup/popup.tsx
 * @Description:
 */

import { Avatar, Button, message, Spin } from "antd"
import { useEffect, useState } from "react"

import "./index.less"

import { SettingOutlined, SyncOutlined } from "@ant-design/icons"

import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })

function IndexPopup() {
  if (process.env.NODE_ENV == "production") {
    window.console.log = (param: any) => {}
    window.console.error = (param: any) => {}
    window.console.warn = (param: any) => {}
    window.console.debug = (param: any) => {}
  }

  const [loading, setLoading] = useState(false)

  const [bg, setBg] = useState<any>("")
  const [messageApi, contextHolder] = message.useMessage({
    top: "60px",
    duration: 2
  })
  useEffect(() => {
    setBg(generateBg())
    const init = async () => {
      try {
      } catch {}
    }
    init()
  }, [])

  const randomNum = (min: number, max: number) => {
    const minCeiled = Math.ceil(min)
    const maxFloored = Math.floor(max)
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled)
  }
  //radial-gradient(shape size at position, start-color, ..., last-color); hsla(hue, saturation, lightness, alpha)
  const generateBg = () => {
    return `radial-gradient(at ${randomNum(20, 40)}% ${randomNum(30, 80)}%, hsla(0, 100%, ${randomNum(70, 100)}%, 0.1) 0, hsla(114, 100%, 100%, 0) 40%),
            radial-gradient(at ${randomNum(50, 70)}% ${randomNum(30, 80)}%, hsla(201, 100%, ${randomNum(70, 100)}%, 0.1) 0, hsla(201, 100%, 100%, 0) 40%),        
            radial-gradient(at ${randomNum(70, 100)}% ${randomNum(30, 80)}%, hsla(112, 100%, ${randomNum(70, 100)}%, 0.1) 0, hsla(112, 100%, 100%, 0) 40%)
            `
  }
  return (
    <div className="layout">
      <Spin fullscreen spinning={loading} size="large"></Spin>

      <div
        className="content"
        style={{
          backgroundColor: "#fff",
          backgroundImage: bg
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "5px 0 10px 0"
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center"
            }}>
            <img
              width={36}
              src={require("data-base64:../../assets/icon.png")}
            />
            <span
              style={{
                textAlign: "center",
                marginLeft: 5,
                backgroundImage: "linear-gradient(to right, #0090ff, #ff65ff)",
                color: "transparent",
                WebkitBackgroundClip: "text",
                fontWeight: 600
              }}>
              Demo
              <br />
              Extension
            </span>
          </div>

          <div>
            <Button
              type="primary"
              style={{ marginLeft: 10 }}
              onClick={() => {}}>
              <SyncOutlined />
            </Button>
          </div>
          <Button onClick={() => {}}>
            <SettingOutlined />
          </Button>
        </div>
      </div>
      <div className="footer"></div>

      {contextHolder}
    </div>
  )
}

export default IndexPopup
