[简体中文](./README.md) | [English](./README.en.md) | [繁體中文](#) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

嘉立創EDA (EasyEDA) 專業版擴展 — 將 PCB 設計匯出為 HyperLynx (.hyp) 檔案格式，用於信號完整性模擬分析。

## 功能

- 匯出 PCB 板框 (`BOARD`)
- 匯出層疊結構 (`STACKUP`)，包含銅箔層與介質層
- 匯出器件資訊 (`DEVICES`)
- 匯出焊盤定義 (`PADSTACK`)，自動去重
- 匯出網路資訊 (`NET`)，包含引腳 (`PIN`)、過孔 (`VIA`)、走線 (`SEG`)、圓弧 (`ARC`)
- 自動處理無網路物件：每個未連接物件單獨歸入 `EmptyNet<N>`
- 座標自動轉換：EasyEDA 內部單位 (mil) → 英吋 (inch)，Y 軸取反
- 相容 HyperLynx v2.14 格式

## 使用方法

1. 在嘉立創EDA專業版中開啟一個 PCB 文件
2. 點擊選單 **Export HyperLynx → Export HyperLynx (.hyp)...**
3. 自動生成並下載 `.hyp` 檔案

## 匯出格式

生成的 `.hyp` 檔案遵循 HyperLynx 2.14 格式規範，包含以下節：

| 節 | 描述 |
|---|------|
| `{VERSION}` | 版本資訊 (2.14) |
| `{UNITS}` | 單位 (ENGLISH LENGTH / 英吋) |
| `{BOARD}` | 板框輪廓 (PERIMETER_SEGMENT) |
| `{STACKUP}` | 層疊定義 (SIGNAL + DIELECTRIC) |
| `{DEVICES}` | 器件列表 (REF + Layer) |
| `{PADSTACK}` | 焊盤堆疊定義 |
| `{NET}` | 網路資料 (PIN / VIA / SEG / ARC) |

更多格式細節請參考 [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md)。

## 專案結構

```text
src/
├── index.ts          # 擴展入口與匯出命令
├── types.ts          # 型別定義與層常數
├── utils.ts          # 單位轉換、焊盤解析、圓弧計算等工具函式
├── collect.ts        # 從 EasyEDA Pro API 收集 PCB 資料
├── generate.ts       # 組裝各節並生成 .hyp 文字
└── writers/
    ├── board.ts      # {BOARD} 板框輸出
    ├── stackup.ts    # {STACKUP} 層疊輸出
    ├── devices.ts    # {DEVICES} 器件輸出
    ├── padstacks.ts  # {PADSTACK} 焊盤堆疊輸出
    └── nets.ts       # {NET} 網路物件輸出
```

## 實作要點

- 板框從 `layer 11`（板框層）讀取，圓弧會被多邊形化為線段。
- 焊盤形狀與鑽孔按 EasyEDA 回傳的元組格式解析，支援橢圓/矩形/圓角矩形/正多邊形近似。
- 通孔與 SMD 焊盤透過是否位於 `MULTI` 層（layer 12）判斷。
- 焊盤堆疊去重綜合考慮形狀 ID、尺寸、角度、鑽孔、層集合及通孔標誌，避免不同層焊盤被錯誤複用。
- 去重邏輯參考 KiCad HyperLynx 匯出器實現，保證相容性。
- 圓弧走線在網路節中輸出為 `ARC`，圓心、半徑按逆時針方向整理。

## 開發

```shell
npm install
npm run build
```

生成的擴展包位於 `./build/dist/export-hyperlynx_v1.0.0.eext`，可在嘉立創EDA專業版中安裝。

## 開源許可

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
