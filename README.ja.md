[简体中文](./README.md) | [English](./README.en.md) | [繁體中文](./README.zh-Hant.md) | [日本語](#) | [Русский](./README.ru.md)

# Export HyperLynx

嘉立创EDA (EasyEDA) 专业版の拡張機能 — PCB 設計を HyperLynx (.hyp) ファイル形式にエクスポートし、信号整合性解析に利用します。

## 機能

- PCB ボード外形 (`BOARD`) のエクスポート
- 積層構造 (`STACKUP`) のエクスポート（銅箔層と誘電体層を含む）
- デバイス情報 (`DEVICES`) のエクスポート
- パッド定義 (`PADSTACK`) のエクスポート、自動重複排除付き
- ネット情報 (`NET`) のエクスポート（ピン `PIN`、ビア `VIA`、配線 `SEG`、円弧 `ARC` を含む）
- 未接続オブジェクトの自動処理：未接続の各プリミティブを個別の `EmptyNet<N>` に振り分け
- 座標の自動変換：EasyEDA 内部単位 (mil) → インチ (inch)、Y 軸反転
- HyperLynx v2.14 形式との互換性

## 使用方法

1. EasyEDA Pro で PCB ドキュメントを開きます
2. メニュー **Export HyperLynx → Export HyperLynx (.hyp)...** をクリックします
3. `.hyp` ファイルが自動生成され、ダウンロードされます

## エクスポート形式

生成される `.hyp` ファイルは HyperLynx 2.14 形式の仕様に従っており、以下のセクションで構成されます：

| セクション | 説明 |
|-----------|------|
| `{VERSION}` | バージョン情報 (2.14) |
| `{UNITS}` | 単位 (ENGLISH LENGTH / インチ) |
| `{BOARD}` | ボード外形 (PERIMETER_SEGMENT) |
| `{STACKUP}` | 積層定義 (SIGNAL + DIELECTRIC) |
| `{DEVICES}` | デバイス一覧 (REF + Layer) |
| `{PADSTACK}` | パッドスタック定義 |
| `{NET}` | ネットデータ (PIN / VIA / SEG / ARC) |

形式の詳細については [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md) を参照してください。

## プロジェクト構成

```text
src/
├── index.ts          # 拡張機能のエントリポイントとエクスポートコマンド
├── types.ts          # 型定義と層定数
├── utils.ts          # 単位換算、パッド解析、円弧計算などのユーティリティ
├── collect.ts        # EasyEDA Pro API から PCB データを収集
├── generate.ts       # 各セクションを組み立てて .hyp テキストを生成
└── writers/
    ├── board.ts      # {BOARD} 外形出力
    ├── stackup.ts    # {STACKUP} 積層出力
    ├── devices.ts    # {DEVICES} デバイス出力
    ├── padstacks.ts  # {PADSTACK} パッドスタック出力
    └── nets.ts       # {NET} ネットオブジェクト出力
```

## 実装上のポイント

- ボード外形は `layer 11`（ボード外形層）から読み取り、円弧は線分に多角形近似されます。
- パッド形状とドリルは EasyEDA が返すタプル形式から解析され、楕円/矩形/角丸矩形/正多角形の近似に対応します。
- スルーホールと SMD パッドは、`MULTI` 層（layer 12）にあるかどうかで判定されます。
- パッドスタックの重複排除では、形状 ID、サイズ、角度、ドリル、層セット、スルーホールフラグを総合的に比較し、異なる層のパッドが誤って共有可能になるのを防ぎます。
- 重複排除ロジックは KiCad の HyperLynx エクスポーター実装と整合し、互換性を保っています。
- 円弧配線はネットセクション内で `ARC` として出力され、円心と半径は反時計回り方向に正規化されます。

## 開発

```shell
npm install
npm run build
```

生成された拡張パッケージは `./build/dist/export-hyperlynx_v1.0.0.eext` にあり、EasyEDA Pro にインストールできます。

## オープンソースライセンス

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
