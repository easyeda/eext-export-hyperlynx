[简体中文](#) | [English](./README.en.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

嘉立创EDA (EasyEDA) 专业版扩展 — 将 PCB 设计导出为 HyperLynx (.hyp) 文件格式，用于信号完整性仿真分析。

## 功能

- 导出 PCB 板框 (BOARD)
- 导出层叠结构 (STACKUP)，包含铜箔层和介质层
- 导出器件信息 (DEVICES)
- 导出焊盘定义 (PADSTACK)，自动去重
- 导出网络信息 (NET)，包含引脚 (PIN)、过孔 (VIA)、走线 (SEG)
- 坐标自动转换：EasyEDA 内部单位 (mil) → 英寸 (inch)
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
| `{NET}` | 网络数据 (PIN / VIA / SEG) |

## 开发

```shell
npm install
npm run build
```

生成的扩展包位于 `./build/dist/export-hyperlynx_v1.0.0.eext`，可在嘉立创EDA专业版中安装。

## 开源许可

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
