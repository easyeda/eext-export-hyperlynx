[简体中文](./README.md) | [English](#) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

An EasyEDA Pro extension that exports PCB designs to HyperLynx (.hyp) file format for signal integrity simulation and analysis.

## Features

- Export board outline (BOARD)
- Export layer stackup (STACKUP) with copper and dielectric layers
- Export device information (DEVICES)
- Export pad stack definitions (PADSTACK) with automatic deduplication
- Export net data (NET) including pins (PIN), vias (VIA), and traces (SEG)
- Automatic coordinate conversion: EasyEDA internal units (mil) → inches
- Compatible with HyperLynx v2.14 format

## Usage

1. Open a PCB document in EasyEDA Pro
2. Click menu **Export HyperLynx → Export HyperLynx (.hyp)...**
3. The `.hyp` file will be generated and downloaded automatically

## Output Format

The generated `.hyp` file follows the HyperLynx 2.14 format specification with the following sections:

| Section | Description |
|---------|-------------|
| `{VERSION}` | Version info (2.14) |
| `{UNITS}` | Units (ENGLISH LENGTH / inches) |
| `{BOARD}` | Board outline (PERIMETER_SEGMENT) |
| `{STACKUP}` | Layer stackup definition (SIGNAL + DIELECTRIC) |
| `{DEVICES}` | Device list (REF + Layer) |
| `{PADSTACK}` | Pad stack definitions |
| `{NET}` | Net data (PIN / VIA / SEG) |

## Development

```shell
npm install
npm run build
```

The extension package is generated at `./build/dist/export-hyperlynx_v1.0.0.eext` and can be installed in EasyEDA Pro.

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
