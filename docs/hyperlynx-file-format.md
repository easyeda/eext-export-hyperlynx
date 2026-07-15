# HyperLynx (.hyp) 文件格式说明

本说明基于 KiCad `pcbnew/exporters/export_hyperlynx.cpp` 的实现，总结 HyperLynx 2.14 ASCII 文件格式的语法与约定，用于指导本扩展生成兼容的 `.hyp` 文件。

## 1. 总体约定

- **文件版本**：文件头必须包含 `{VERSION=2.14}`。
- **单位**：紧随其后的 `{UNITS=ENGLISH LENGTH}` 表示所有几何尺寸以 **英寸 (inch)** 为单位。
- **坐标系**：KiCad 内部使用纳米 (nm)，导出时通过 `iu / 1e9 / 0.0254` 转换为英寸；EasyEDA 内部使用 mil，导出时通过 `mil / 1000` 转换为英寸。
- **Y 轴方向**：HyperLynx 与 KiCad/EasyEDA 的 Y 轴方向相反，因此导出时所有 Y 坐标取负值（`Y_hyp = -Y_eda`）。
- **层名长度**：`STACKUP`、`DEVICES`、`NET` 中使用的层名长度不得超过 20 个字符，超出部分会被截断。
- **字符串转义**：层名中若含非法字符，应替换为下划线 `_`。

## 2. 文件结构

```text
{VERSION=2.14}
{UNITS=ENGLISH LENGTH}

{BOARD "<filename>"
  (PERIMETER_SEGMENT X1=... Y1=... X2=... Y2=...)
  ...
}

{STACKUP
  (SIGNAL T=... P=... C=... L="..." M=COPPER)
  (DIELECTRIC T=... C=... L="..." M="...")
  ...
}

{DEVICES
  (? REF="..." L="...")
  ...
}

{PADSTACK=<id>, <drill_diameter>
  ("<layer_or_MDEF>", <shape_id>, <sx>, <sy>, <angle>, M)
}

{NET="<net_name>"
  (PIN X=... Y=... R="<ref>.<pad_number>" P=<padstack_id>)
  (VIA X=... Y=... P=<padstack_id>)
  (SEG X1=... Y1=... X2=... Y2=... W=... L="<layer>")
  (ARC X1=... Y1=... X2=... Y2=... XC=... YC=... R=... W=... L="<layer>")
  {POLYGON T=POUR L="<layer>" ID=<id> X=... Y=...
    (LINE X=... Y=...)
    ...
  }
  {POLYVOID ID=<id> X=... Y=...
    (LINE X=... Y=...)
    ...
  }
}

{END}
```

## 3. 各节详细说明

### 3.1 `{VERSION}` 与 `{UNITS}`

```text
{VERSION=2.14}
{UNITS=ENGLISH LENGTH}
```

- 必须位于文件最开头。
- 两行间空一行，与后续 `{BOARD}` 之间也空一行。

### 3.2 `{BOARD}` — 板框轮廓

```text
{BOARD "<filename>"
  (PERIMETER_SEGMENT X1=... Y1=... X2=... Y2=...)
  ...
}
```

- 板框由若干直线段 `PERIMETER_SEGMENT` 组成，按顺序连接形成闭合轮廓。
- 若存在多个不相连的轮廓（例如板内挖空），则依次写出多组线段。
- 坐标值使用英寸，Y 坐标取反。
- 文件名 `"<filename>"` 仅用于注释，不影响解析。

### 3.3 `{STACKUP}` — 层叠结构

```text
{STACKUP
  (SIGNAL T=<thickness> P=<plating> C=<resistivity> L="<layer_name>" M=COPPER)
  (DIELECTRIC T=<thickness> C=<epsilon_r> L="<layer_label>" M="<material>")
  ...
}
```

- `SIGNAL`：每个导电铜层一条，按从顶层到底层的顺序排列。
  - `T`：铜箔厚度（英寸）。
  - `P`：电镀厚度（英寸），通常填 `0`。
  - `C`：铜的体电阻率，约 `1.724e-8` Ω·m。
  - `L`：层名，长度 ≤ 20。
  - `M`：材料，固定为 `COPPER`。
- `DIELECTRIC`：位于相邻两层之间的介质层。
  - `T`：介质厚度（英寸）。
  - `C`：介电常数 εr，典型 FR4 约 `4.5`。
  - `L`：介质标签，长度 ≤ 20，KiCad 使用 `DE_<上层铜层名>` 或 `DE<n>_<上层铜层名>`。
  - `M`：材料名，例如 `"FR4"`、 `"Solder Mask"`。

### 3.4 `{DEVICES}` — 器件

```text
{DEVICES
  (? REF="<designator>" L="<layer>")
  ...
}
```

- 每个器件一行。
- `?` 为占位符，固定不变。
- `REF`：位号，如 `R1`、`U2`。若为空，KiCad 输出 `EMPTY`。
- `L`：器件所在层名。

### 3.5 `{PADSTACK}` — 焊盘/过孔堆叠

```text
{PADSTACK=<id>, <drill_diameter>
  ("<layer_or_MDEF>", <shape_id>, <sx>, <sy>, <angle>, M)
}
```

- `<id>`：从 0 开始的整数，在 `NET` 节中通过 `P=<id>` 引用。
- `<drill_diameter>`：钻孔直径（英寸）。SMD 焊盘无孔时填 `0`。
- 每个 `{PADSTACK}` 内部可包含多行，每行对应一个层上的焊盘形状。
- 若焊盘出现在所有铜层（通孔），使用 `"MDEF"` 作为层占位符；否则为每个出现的铜层分别写出 `"<layer_name>"`。
- 形状参数：
  - `<shape_id>`：`0` 圆形/椭圆，`1` 矩形，`2` 圆角矩形。
  - `<sx>, <sy>`：焊盘在 X/Y 方向的尺寸（英寸）。
  - `<angle>`：旋转角度（度），范围 `[0, 360)`。
  - `M`：固定标记。

### 3.6 `{NET}` — 网络

每个网络独立一节：

```text
{NET="<net_name>"
  ...objects...
}
```

网络内可包含以下对象：

#### 3.6.1 `PIN` — 焊盘引脚

```text
(PIN X=... Y=... R="<ref>.<pad_number>" P=<padstack_id>)
```

- `R`：位号与焊盘编号组合，如 `R1.1`。
- 若位号为空，使用 `EMPTY`；若焊盘编号为空，默认使用 `1`。

#### 3.6.2 `VIA` — 过孔

```text
(VIA X=... Y=... P=<padstack_id>)
```

#### 3.6.3 `SEG` — 走线线段

```text
(SEG X1=... Y1=... X2=... Y2=... W=... L="<layer>")
```

- `W`：线宽（英寸）。
- `L`：所在层名。

#### 3.6.4 `ARC` — 圆弧走线

```text
(ARC X1=... Y1=... X2=... Y2=... XC=... YC=... R=... W=... L="<layer>")
```

- `X1,Y1`：起点；`X2,Y2`：终点；`XC,YC`：圆心；`R`：半径。
- 圆弧方向通过起终点的顺序体现；导出时应统一按逆时针（CCW）方向排列起点和终点。

#### 3.6.5 `POLYGON` / `POLYVOID` — 铺铜/挖空

```text
{POLYGON T=POUR L="<layer>" ID=<id> X=... Y=...
  (LINE X=... Y=...)
  ...
}
```

- 多边形由第一个顶点 `X,Y` 开始，随后按顺序给出所有边界点 `(LINE X=... Y=...)`，最后需回到第一个顶点形成闭合。
- `<id>` 为全局递增整数，从 1 开始。
- 挖空区域使用 `{POLYVOID ID=<id> ...}`，引用所属 `POLYGON` 的 ID。

### 3.7 未连接对象（空网络）

对于没有网络名或网络码 ≤ 0 的对象，KiCad 为每个对象单独生成一个名为 `EmptyNet<N>` 的网络节，避免丢失未连接的焊盘、过孔或走线。

### 3.8 `{END}`

文件以 `{END}` 结尾。

## 4. 关键实现注意事项

1. **尺寸精度**：坐标和尺寸建议使用 9~10 位小数输出，保证仿真精度。
2. **焊盘去重**：通孔焊盘/过孔的去重必须同时比较形状、尺寸、角度、钻孔、层集合；SMD 焊盘还需比较所在层，避免不同层焊盘错误复用同一 PADSTACK。
3. **层集合映射**：SMD 焊盘只出现在其所在铜层；通孔焊盘和过孔出现在所有铜层。
4. **圆弧方向**：导出 ARC 时应检查方向，统一按逆时针输出起点/终点。
5. **铺铜多边形**：应使用 `LINE` 序列闭合轮廓，并单独输出挖空 `POLYVOID`。
6. **层名截断与清理**：超过 20 字符的层名应截断，非法字符替换为 `_`。
