[简体中文](#) | [English](./README.en.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

嘉立创EDA (EasyEDA) 专业版扩展 — 将 PCB 设计导出为 HyperLynx (.hyp) 文件格式，用于信号完整性仿真分析。

## 功能

- 导出 PCB 板框 (`BOARD`)
- 导出层叠结构 (`STACKUP`)，包含铜箔层和介质层
- 导出器件信息 (`DEVICES`)
- 导出焊盘定义 (`PADSTACK`)，自动去重
- 导出网络信息 (`NET`)，包含引脚 (`PIN`)、过孔 (`VIA`)、走线 (`SEG`)、圆弧 (`ARC`)
- 自动处理无网络对象：每个未连接对象单独归入 `EmptyNet<N>`
- 坐标自动转换：EasyEDA 内部单位 (mil) → 英寸 (inch)，Y 轴取反
- 兼容 HyperLynx v2.14 格式

## 使用方法

1. 在嘉立创EDA专业版中打开一个 PCB 文档
2. 点击菜单栏 **Export HyperLynx → Export HyperLynx (.hyp)...**
3. 自动生成并下载 `.hyp` 文件

## 导出格式

生成的 `.hyp` 文件遵循 HyperLynx 2.14 格式规范，包含以下节：

| 节 | 描述 |
|---|------|
| `{VERSION}` | 版本信息 (2.14) |
| `{UNITS}` | 单位 (ENGLISH LENGTH / 英寸) |
| `{BOARD}` | 板框轮廓 (PERIMETER_SEGMENT) |
| `{STACKUP}` | 层叠定义 (SIGNAL + DIELECTRIC) |
| `{DEVICES}` | 器件列表 (REF + Layer) |
| `{PADSTACK}` | 焊盘堆叠定义 |
| `{NET}` | 网络数据 (PIN / VIA / SEG / ARC) |

更多格式细节请参考 [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md)。

## 项目结构

```text
src/
├── index.ts          # 扩展入口与导出命令
├── types.ts          # 类型定义与层常量
├── utils.ts          # 单位转换、焊盘解析、圆弧计算等工具函数
├── collect.ts        # 从 EasyEDA Pro API 收集 PCB 数据
├── generate.ts       # 组装各节并生成 .hyp 文本
└── writers/
    ├── board.ts      # {BOARD} 板框输出
    ├── stackup.ts    # {STACKUP} 层叠输出
    ├── devices.ts    # {DEVICES} 器件输出
    ├── padstacks.ts  # {PADSTACK} 焊盘堆叠输出
    └── nets.ts       # {NET} 网络对象输出
```

## 实现要点

- 板框从 `layer 11`（板框层）读取，圆弧会被多边形化为线段。
- 焊盘形状与钻孔按 EasyEDA 返回的元组格式解析，支持椭圆/矩形/圆角矩形/正多边形近似。
- 通孔与 SMD 焊盘通过是否位于 `MULTI` 层（layer 12）判断。
- 焊盘堆叠去重综合考虑形状 ID、尺寸、角度、钻孔、层集合及通孔标志，避免不同层焊盘被错误复用。
- 去重逻辑参考 KiCad HyperLynx 导出器实现，保证兼容性。
- 圆弧走线在网络节中输出为 `ARC`，圆心、半径按逆时针方向整理。

## 开发

```shell
npm install
npm run build
```

生成的扩展包位于 `./build/dist/export-hyperlynx_v1.0.0.eext`，可在嘉立创EDA专业版中安装。

## 开源许可

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
