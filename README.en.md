[简体中文](./README.md) | [English](#) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

# Export HyperLynx

An EasyEDA Pro extension that exports PCB designs to HyperLynx (.hyp) file format for signal integrity simulation and analysis.

## Features

- Export board outline (`BOARD`)
- Export layer stackup (`STACKUP`) with copper and dielectric layers
- Export device information (`DEVICES`)
- Export pad stack definitions (`PADSTACK`) with automatic deduplication
- Export net data (`NET`) including pins (`PIN`), vias (`VIA`), traces (`SEG`), and arcs (`ARC`)
- Handle unconnected objects: each unconnected primitive is placed in its own `EmptyNet<N>`
- Automatic coordinate conversion: EasyEDA internal units (mil) → inches, with Y-axis inverted
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
| `{NET}` | Net data (PIN / VIA / SEG / ARC) |

For more format details, see [docs/hyperlynx-file-format.md](./docs/hyperlynx-file-format.md).

## Project Structure

```text
src/
├── index.ts          # Extension entry point and export command
├── types.ts          # Type definitions and layer constants
├── utils.ts          # Unit conversion, pad parsing, arc calculation helpers
├── collect.ts        # Collect PCB data from the EasyEDA Pro API
├── generate.ts       # Assemble sections and generate the .hyp text
└── writers/
    ├── board.ts      # {BOARD} outline writer
    ├── stackup.ts    # {STACKUP} writer
    ├── devices.ts    # {DEVICES} writer
    ├── padstacks.ts  # {PADSTACK} writer
    └── nets.ts       # {NET} object writer
```

## Implementation Notes

- Board outline is read from `layer 11` (board outline layer); arcs are polygonized into line segments.
- Pad shapes and drills are parsed from EasyEDA tuple values; ellipse / rectangle / rounded rectangle / regular polygon approximations are supported.
- Through-hole vs SMD pads are determined by whether the pad resides on the `MULTI` layer (layer 12).
- Pad stack deduplication accounts for shape ID, size, angle, drill, layer set, and through-hole flag to avoid incorrectly reusing pads across different layers.
- Deduplication logic is aligned with the KiCad HyperLynx exporter for compatibility.
- Arc traces are emitted as `ARC` entries in net sections, with center and radius normalized to counter-clockwise orientation.

## Development

```shell
npm install
npm run build
```

The extension package is generated at `./build/dist/export-hyperlynx_v1.0.0.eext` and can be installed in EasyEDA Pro.

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)
