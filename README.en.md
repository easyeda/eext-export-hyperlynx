[简体中文](./README.md) | [English](#) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

An EasyEDA Pro extension that exports PCB designs to HyperLynx (.hyp) file format for signal-integrity simulation and analysis.

## Features

- Export the current PCB document to a HyperLynx 2.14 `.hyp` file
- Includes:
  - Board outline (`BOARD`)
  - Layer stackup (`STACKUP`) with copper and dielectric layers
  - Device list (`DEVICES`)
  - Pad/via stack definitions (`PADSTACK`)
  - Net data (`NET`): pins (`PIN`), vias (`VIA`), traces (`SEG`), arcs (`ARC`), and copper-pour polygons (`POLYGON`)
- Automatically handles unconnected objects so nothing is silently lost
- Automatic coordinate conversion from mil to inches, matching the HyperLynx coordinate system
- One-click export from the top menu

## Usage

1. Open a PCB document in EasyEDA Pro
2. Click the top menu **Export HyperLynx → Export HyperLynx (.hyp)...**
3. Choose a location in the save dialog to generate the `.hyp` file

## Output File

The generated `.hyp` file follows the HyperLynx 2.14 ASCII format specification and contains the following sections:

| Section | Content |
|---------|---------|
| `{VERSION}` | Format version 2.14 |
| `{UNITS}` | English length units (inches) |
| `{BOARD}` | Board outline |
| `{STACKUP}` | Copper and dielectric layer stackup |
| `{DEVICES}` | Component references and layers |
| `{PADSTACK}` | Pad and via stack definitions |
| `{NET}` | Net objects (PIN / VIA / SEG / ARC / POLYGON) |

For more format details, see [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md).

## Compatibility and Limitations

- Requires EasyEDA Pro 3.2.0 or later
- Make sure the PCB document is saved and contains the required copper layer information before exporting
- Arcs in complex board outlines are polygonized into line segments
- Unsupported pad shapes are approximated as ellipses / circles
- Board cutouts and slots may not be exported
- It is recommended to verify critical dimensions after importing into PADS or HyperLynx

## Project Structure (for developers)

```text
src/
├── index.ts    # Extension entry and export command
├── collect.ts  # PCB data collection
├── generate.ts # .hyp file generation
├── types.ts    # Type definitions
├── utils.ts    # Utility functions
└── writers/    # Section writers
    ├── board.ts
    ├── stackup.ts
    ├── devices.ts
    ├── padstacks.ts
    └── nets.ts
```

## Development

```shell
npm install
npm run build
```

The extension package is generated at:

```text
./build/dist/export-hyperlynx_v1.0.0.eext
```

Install the generated `.eext` package in EasyEDA Pro.

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
