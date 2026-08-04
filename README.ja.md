[简体中文](./README.md) | [English](./README.en.md) | [繁體中文](./README.zh-Hant.md) | [日本語](#) | [Русский](./README.ru.md)

# Export HyperLynx

EasyEDA Pro 拡張機能 — PCB 設計を HyperLynx (.hyp) ファイル形式にエクスポートし、信号整合性解析に利用します。

## 機能

- 現在の PCB 文書を HyperLynx 2.14 形式の `.hyp` ファイルにエクスポート
- エクスポート対象：
  - 基板外形 (`BOARD`)
  - 層構成 (`STACKUP`)：銅箔層と誘電体層
  - デバイス情報 (`DEVICES`)
  - パッド/ビア スタック (`PADSTACK`)
  - ネットデータ (`NET`)：ピン (`PIN`)、ビア (`VIA`)、配線 (`SEG`)、弧 (`ARC`)、ポリゴン プール (`POLYGON`)
- 未接続オブジェクトを自動処理し、データ欠落を防止
- 座標を mil からインチに自動変換し、HyperLynx 座標系に対応
- ヘッダーメニューからワンクリックでエクスポート

## 使用方法

1. EasyEDA Pro で PCB 文書を開く
2. 上部メニュー **Export HyperLynx → Export HyperLynx (.hyp)...** をクリック
3. 保存ダイアログで保存先を選択し、`.hyp` ファイルを生成

## 出力ファイル

生成される `.hyp` ファイルは HyperLynx 2.14 ASCII 形式に準拠しており、以下のセクションで構成されます：

| セクション | 内容 |
|-----------|------|
| `{VERSION}` | 形式バージョン 2.14 |
| `{UNITS}` | インチによる英制長さ単位 |
| `{BOARD}` | 基板外形 |
| `{STACKUP}` | 銅層と誘電体の層構成情報 |
| `{DEVICES}` | デバイス参照番号と所在層 |
| `{PADSTACK}` | パッド/ビア スタック定義 |
| `{NET}` | ネットオブジェクト (PIN / VIA / SEG / ARC / POLYGON) |

形式の詳細については [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md) を参照してください。

## 互換性と制限事項

- EasyEDA Pro 3.2.0 以降が必要
- エクスポート前に PCB 文書を保存し、必要な銅層情報が含まれていることを確認してください
- 複雑な基板外形の円弧は線分に離散化されます
- 未対応のパッド形状は楕円/円で近似されます
- 基板内の切り欠き/スロット情報はエクスポートされない場合があります
- PADS または HyperLynx へインポート後、主要寸法を確認することを推奨します

## プロジェクト構成（開発者向け）

```text
src/
├── index.ts    # 拡張機能エントリとエクスポートコマンド
├── collect.ts  # PCB データ収集
├── generate.ts # .hyp ファイル生成
├── types.ts    # 型定義
├── utils.ts    # ユーティリティ関数
└── writers/    # 各セクションの出力実装
    ├── board.ts
    ├── stackup.ts
    ├── devices.ts
    ├── padstacks.ts
    └── nets.ts
```

## 開発

```shell
npm install
npm run build
```

拡張パッケージの生成場所：

```text
./build/dist/export-hyperlynx_v1.0.0.eext
```

生成された `.eext` パッケージを EasyEDA Pro にインストールしてください。

## オープンソースライセンス

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
