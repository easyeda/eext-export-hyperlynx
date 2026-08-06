[简体中文](#) | [English](./README.en.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

嘉立创EDA (EasyEDA) 专业版扩展 — 将 PCB 设计导出为 HyperLynx (.hyp) 文件格式，用于信号完整性仿真分析。

![alt text](images/image1.png)

## 功能特点

- 将当前 PCB 文档导出为 HyperLynx 2.14 格式 `.hyp` 文件
- 导出内容包含：
  - 板框轮廓 (`BOARD`)
  - 层叠结构 (`STACKUP`)，包含铜箔层与介质层
  - 器件信息 (`DEVICES`)
  - 焊盘/过孔堆叠 (`PADSTACK`)
  - 网络数据 (`NET`)：引脚 (`PIN`)、过孔 (`VIA`)、走线 (`SEG`)、圆弧 (`ARC`)、铺铜多边形 (`POLYGON`)
- 自动处理未连接对象，避免数据丢失
- 坐标自动从 mil 转换为英寸，保持与 HyperLynx 坐标系一致
- 通过顶部菜单一键导出

## 使用方法

1. 在嘉立创EDA专业版中打开一个 PCB 文档
2. 点击顶部菜单 **Export HyperLynx → Export HyperLynx (.hyp)...**
3. 在弹出的保存对话框中选择位置，生成 `.hyp` 文件

## 输出文件说明

生成的 `.hyp` 文件遵循 HyperLynx 2.14 ASCII 格式规范，主要包含以下节：

| 节 | 内容 |
|----|------|
| `{VERSION}` | 格式版本 2.14 |
| `{UNITS}` | 英制长度单位（英寸） |
| `{BOARD}` | 板框轮廓 |
| `{STACKUP}` | 铜层与介质层叠信息 |
| `{DEVICES}` | 器件位号与所在层 |
| `{PADSTACK}` | 焊盘与过孔堆叠定义 |
| `{NET}` | 网络对象（PIN / VIA / SEG / ARC / POLYGON） |

更多格式细节可参考 [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md)。

## 兼容性与限制

- 需要嘉立创EDA专业版（EasyEDA Pro）3.2.0 及以上版本
- 导出前请确保 PCB 文档已保存，并且包含所需的铜层信息
- 复杂板框中的圆弧会被离散为线段
- 不支持的焊盘形状将按椭圆/圆形近似
- 板内挖空、开槽等信息可能无法导出
- 建议导入 PADS 或 HyperLynx 后核对关键尺寸

## 项目结构（开发者参考）

```text
src/
├── index.ts    # 扩展入口与导出命令
├── collect.ts  # PCB 数据收集
├── generate.ts # .hyp 文件生成
├── types.ts    # 类型定义
├── utils.ts    # 工具函数
└── writers/    # 各节输出实现
    ├── board.ts
    ├── stackup.ts
    ├── devices.ts
    ├── padstacks.ts
    └── nets.ts
```

## 开发

```shell
npm install
npm run build
```

扩展包生成位置：

```text
./build/dist/export-hyperlynx_v1.0.0.eext
```

可在嘉立创EDA专业版中安装该扩展包。

## 开源许可

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
