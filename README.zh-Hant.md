[简体中文](./README.md) | [English](./README.en.md) | [繁體中文](#) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

嘉立創EDA (EasyEDA) 專業版擴展 — 將 PCB 設計匯出為 HyperLynx (.hyp) 檔案格式，用於信號完整性模擬分析。

![alt text](images/image1.png)

## 功能特點

- 將目前 PCB 文件匯出為 HyperLynx 2.14 格式 `.hyp` 檔案
- 匯出內容包含：
  - 板框輪廓 (`BOARD`)
  - 層疊結構 (`STACKUP`)，包含銅箔層與介質層
  - 器件資訊 (`DEVICES`)
  - 焊盤/過孔堆疊 (`PADSTACK`)
  - 網路資料 (`NET`)：引腳 (`PIN`)、過孔 (`VIA`)、走線 (`SEG`)、圓弧 (`ARC`)、鋪銅多邊形 (`POLYGON`)
- 自動處理未連接物件，避免資料遺失
- 座標自動 mil 轉換為英吋，保持與 HyperLynx 座標系一致
- 透過頂部選單一鍵匯出

## 使用方法

1. 在嘉立創EDA專業版中開啟一個 PCB 文件
2. 點擊頂部選單 **Export HyperLynx → Export HyperLynx (.hyp)...**
3. 在彈出的儲存對話框中選擇位置，生成 `.hyp` 檔案

## 匯出檔案說明

生成的 `.hyp` 檔案遵循 HyperLynx 2.14 ASCII 格式規範，主要包含以下節：

| 節 | 內容 |
|----|------|
| `{VERSION}` | 格式版本 2.14 |
| `{UNITS}` | 英制長度單位（英吋） |
| `{BOARD}` | 板框輪廓 |
| `{STACKUP}` | 銅與介質層疊資訊 |
| `{DEVICES}` | 器件位號與所在層 |
| `{PADSTACK}` | 焊盤與過孔堆疊定義 |
| `{NET}` | 網路物件（PIN / VIA / SEG / ARC / POLYGON） |

更多格式細節可參考 [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md)。

## 相容性與限制

- 需要嘉立創EDA專業版（EasyEDA Pro）3.2.0 及以上版本
- 匯出前請確保 PCB 文件已儲存，並且包含所需的銅層資訊
- 複雜板框中的圓弧會被離散為線段
- 不支援的焊盤形狀將按橢圓/圓形近似
- 板內挖空、開槽等資訊可能無法匯出
- 建議匯入 PADS 或 HyperLynx 後核對關鍵尺寸

## 專案結構（開發者參考）

```text
src/
├── index.ts    # 擴展入口與匯出命令
├── collect.ts  # PCB 資料收集
├── generate.ts # .hyp 檔案生成
├── types.ts    # 型別定義
├── utils.ts    # 工具函式
└── writers/    # 各節輸出實作
    ├── board.ts
    ├── stackup.ts
    ├── devices.ts
    ├── padstacks.ts
    └── nets.ts
```

## 開發

```shell
npm install
npm run build
```

擴展包生成位置：

```text
./build/dist/export-hyperlynx_v1.0.0.eext
```

可在嘉立創EDA專業版中安裝該擴展包。

## 開源許可

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
