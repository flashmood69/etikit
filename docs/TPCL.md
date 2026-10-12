# Toshiba TEC Printer Command Language (TPCL/TGL) Reference

> **Disclaimer:** This is an unofficial, independently prepared reference. It
> is not authored, reviewed, approved, or endorsed by Toshiba TEC. It is
> provided “as is,” without warranties of accuracy, completeness, or fitness
> for a particular purpose. Commands vary by printer, firmware, configuration,
> and options; verify them on the intended equipment before use. To the extent
> permitted by law, the author and publisher disclaim liability for loss or
> damage arising from reliance on this document. Toshiba and product names
> belong to their respective owners.

This is a practical, example-first reference. Command variants below are drawn
from the supplied TPCL notes and template. Values are not universal across
Toshiba printer families.

## Contents

- [Read This First](#read-this-first)
- [Label Setup](#label-setup)
- [Text](#text)
- [Barcodes](#barcodes)
- [Lines, Areas, and Graphics](#lines-areas-and-graphics)
- [Print and Media Movement](#print-and-media-movement)
- [Status and Optional Features](#status-and-optional-features)
- [Complete Template Example](#complete-template-example)
- [Before Printing](#before-printing)

## Read This First

A common TPCL command has this shape:

```text
{COMMAND;parameter1,parameter2|}
```

The separator and terminator are adjacent:

```text
{C|}
```

- `{` starts the command, `|` separates command content from `}`, and `}` ends
  it. Printers can be configured for different control-code framing.
- Some commands define a field and others provide its data. For example,
  `{PC022;...|}` defines text field `022`; `{RC022;text|}` supplies its text.
- Field coordinates in the common drawing commands below use **0.1 mm**:
  `0253` means 25.3 mm. The physical origin depends on printer setup.
- The `D` command defines media size and is not necessarily in the same units
  or field order on every model. Legacy graphics can use dot-based dimensions.
- Do not include the explanatory brackets in a command. Keep the `|}` ending
  when sending examples from this document.

### Reserved Characters and Escaping

There are two layers to keep separate: command syntax and field data.

| Character | Meaning in command syntax | In text data |
|---|---|---|
| `{` | Starts a command in brace framing. | Do not embed raw unless the target printer documents a way to do so. |
| `\|` | Separates command content from the `}` terminator in this framing. | Treat as framing-sensitive; no universal literal escape is documented here. |
| `}` | Ends a command in brace framing. | Do not embed raw unless the target printer documents a way to do so. |
| `;` | Separates a command and field identifier from its parameters or data. | After the data portion has begun, it may be ordinary data; confirm for the specific command and model. |
| `,` | Separates parameters in commands such as `PC` and `PV`. | In a data payload, it may be ordinary data rather than a parameter separator. |
| `[` and `]` | Often mark optional syntax, placeholders, or control-code notation in manuals. | They are not automatically syntax. If sent in a field payload, they may print as literal brackets. |

The exact point where a command switches from parameters to payload depends on
its grammar. For example, `RC` has a field identifier and a data portion;
inline-data forms put text after `=`. Do not apply the comma-separated
parameter rules to the payload, or assume all commands parse payloads alike.

No general TPCL string-quoting convention is established here. In particular,
do not assume backslash, doubled delimiters, or Toshiba driver notation such
as `^#nn` escapes framing characters. Driver byte insertion and barcode-font
function-character rules are separate mechanisms.

#### Toshiba Driver Hex-Byte Notation

The Toshiba barcode-printer driver documents hex entry for binary barcode
data. The table below expresses selected ASCII bytes in the requested
`^#nn` notation, where `nn` is the two-digit hexadecimal byte value:

| Character or control | Hex byte | Notation |
|---|---:|---|
| NUL | `00` | `^#00` |
| Tab | `09` | `^#09` |
| Line feed (LF) | `0A` | `^#0A` |
| Carriage return (CR) | `0D` | `^#0D` |
| Comma `,` | `2C` | `^#2C` |
| Semicolon `;` | `3B` | `^#3B` |
| Left square bracket `[` | `5B` | `^#5B` |
| Backslash `\` | `5C` | `^#5C` |
| Caret `^` | `5E` | `^#5E` |
| Right square bracket `]` | `5D` | `^#5D` |
| Left brace `{` | `7B` | `^#7B` |
| Vertical bar `\|` | `7C` | `^#7C` |
| Right brace `}` | `7D` | `^#7D` |

**Important:** These entries identify byte values; they are not universal
TPCL escapes. Toshiba driver documentation describes hex entry as `^#nn`,
but its worked example writes bytes as `^00^01...`. Follow the exact notation
required by the driver version and input field. The documented use is
driver-mediated binary barcode data, not arbitrary text-field quoting. In a
raw TPCL stream, byte `7B`, `7C`, or `7D` is still `{`, `|`, or `}` and can
still be interpreted as command framing.

When data includes framing or control characters, use only a literal-data or
alternate-framing method documented for the target printer. Otherwise,
validate or transform the value on the host, then test the exact transmitted
bytes and printed result.

## Label Setup

### `C` — Clear Image

Clears the current label image. Commonly sent before defining a new label.

```text
{C|}
```

This clears the image, not stored printer memory or printer settings.

### `D` — Label Size

Common three-value form:

```text
{D0630,1040,0600|}
```

In the supplied template convention, values mean:

| Value | Meaning |
|---|---|
| `0630` | Label pitch: 63.0 mm |
| `1040` | Effective print width: 104.0 mm |
| `0600` | Effective print length: 60.0 mm |

Pitch is the media advance per label and may differ from the printed length.
Some legacy forms use a `D...E` variant for label length/pitch or gap without
setting width. Check the printer's configured form before reusing dimensions.

### `AX`, `AY`, and `AR` — Adjustments

```text
{AX;+000,+000,+00|}
{AY;+10,0|}
{AR;length|}
```

`AX` adjusts media position, commonly feed, cut/strip, and back-feed distances.
`AY` adjusts print density. `AR` sets a pre-feed length in successive issue
mode on printers that support it. Values and field meanings vary; adjustments
can affect later jobs as well as the current one.

## Text

Text can be included inline in `PC` or supplied separately with `RC`:

```text
{PC022;0245,0355,10,10,Q,00,B|}
{RC022;field2|}
```

Some implementations also accept the text after `=` in the `PC` command:

```text
{PC022;0245,0355,10,10,Q,00,B=field2|}
```

Choose one form for a field. In implementations that accept both, a later
`RC` value replaces text previously supplied inline in `PC`.

### `PC` — Bitmap Text Format

`PC` defines a bitmap-font field. In either example above:

| Part | Meaning |
|---|---|
| `PC022` | Text field ID `022` |
| `0245,0355` | Position: x = 24.5 mm, y = 35.5 mm |
| `10,10` | Horizontal and vertical expansion |
| `Q` | Font ID |
| `00,B` | Additional attributes; exact meaning is model-dependent |

Common font IDs in the supplied template:

| ID | Font | Style | Nominal size |
|---|---|---|---:|
| A | Times Roman | Medium | 8 pt |
| B | Times Roman | Medium | 10 pt |
| C | Times Roman | Bold | 10 pt |
| D | Times Roman | Bold | 12 pt |
| E | Times Roman | Bold | 14 pt |
| F | Times Roman | Italic | 12 pt |
| G | Helvetica | Medium | 6 pt |
| H | Helvetica | Medium | 10 pt |
| I | Helvetica | Medium | 12 pt |
| J | Helvetica | Bold | 12 pt |
| K | Helvetica | Bold | 14 pt |
| L | Helvetica | Italic | 12 pt |
| M | Presentation | Bold | 18 pt |
| N | Letter Gothic | Medium | 9.5 pt |
| O | Prestige Elite | Medium | 7 pt |
| P | Prestige Elite | Medium | 10 pt |
| Q | Courier | Medium | 10 pt |
| R | Courier | Bold | 12 pt |
| S | OCR-A | — | 12 pt |
| T | OCR-B | — | 12 pt |

Font availability and attributes vary by printer. Treat this as a common font
map, not a guarantee that every model provides every font.

### `RC` — Bitmap Text Data

`RC` supplies or replaces the content for a matching `PC` field:

```text
{PC022;0245,0355,10,10,Q,00,B|}
{RC022;field2|}
```

The host can substitute database or variable values into `RC` fields. Inline
data support and replacement behavior can vary by printer; check character
encoding, field length, and delimiter handling for the printer and font in use.

### `PV` and `RV` — Outline Text

The text can be sent inline in the `PV` command, or as a separate `RV`
data command when that printer's TPCL variant supports it. These are
alternative forms for the field; do not send both for the same value.

**Inline text:**

```text
{PV00;0025,0086,0026,0028,B,00,B=[DESIGNATION]|}
```

**Separate field data:**

```text
{PV00;0025,0086,0026,0028,B,00,B|}
{RV00;DESIGNATION|}
```

Use one form or the other. Font, size, and option values are model-specific;
some outline-font selections may require a downloadable font. OpenType shaping
and bidirectional text support are optional, not universal.

## Barcodes

### `XB` and `RB` — Barcode Format and Data

`XB` defines the barcode field; `RB` supplies its payload:

```text
{XB01;0800,0150,T,H,05,A,1|}
{RB01;field10|}
```

In the supplied template convention, `T` selects QR Code. The remaining
parameters are barcode-specific; do not assume their meaning is the same for
another model.

Common type identifiers in the supplied notes:

| ID | Symbology |
|---|---|
| `3` | Code 39 |
| `9` | Code 128, automatic subset selection |
| `P` | PDF417 |
| `Q` | Data Matrix |
| `T` | QR Code |

These identifiers are implementation-specific. Common printer barcode
families also include EAN/UPC/JAN, ITF, NW-7/Codabar, MSI, postal codes, and
GS1 DataBar. Availability, check digits, subsets, module size, human-readable
text, and options vary.

Some command variants carry barcode data inline after `=` instead of using
`RB`. Use the data style supported by the target printer; do not combine both
forms by assumption.

For 2D symbols such as QR Code, Data Matrix, and PDF417, check the supported
symbol types, error-correction settings, encoding, module size, and payload
limits. Verify that the printed symbol scans correctly on the actual media.

## Lines, Areas, and Graphics

### `LC` — Line or Shape

The first four values give two points in 0.1 mm:

```text
{LC;0842,0136,0842,0306,0,3|}
```

This connects (84.2 mm, 13.6 mm) to (84.2 mm, 30.6 mm). Remaining values
control line width/style and are model-dependent. Supported forms may draw
rectangles or rounded shapes as well as straight lines.

### `XR` — Clear or Invert Area

```text
{XR;0241,0000,0251,0354,B|}
```

Defines an area using coordinates in 0.1 mm and a mode/attribute. Whether the
area is cleared or inverted depends on the supported mode.

### `SG` — Graphic

`SG` prints/transfers graphic data. Common forms place and size graphics in
0.1 mm; legacy `SG0`/`SG1` forms can specify dimensions in multiples of 8 dots.
Graphic modes and image encodings vary. Preserve binary data exactly when
sending it.

### `XD` — Writable Bitmap Character

`XD` stores bitmap characters or logos in printer memory on supported models.
Storage allocation, memory type, character codes, and later printing behavior
are model-specific. Treat memory-format commands as destructive.

## Print and Media Movement

### `XS` — Issue / Print

```text
{XS;I,0001,0002C3200|}
```

`0001` is the requested label count in the supplied example. The trailing
option block can encode cut/issue mode, sensor, speed, ribbon, rotation, and
status response. The `I` selector and option positions vary by printer.

Common sensor values in the supplied notes:

| Value | Sensor mode |
|---|---|
| `0` | No sensor |
| `1` | Reflective |
| `2` | Transmissive, standard labels |
| `3` | Transmissive, preprinted labels |
| `4` | Reflective, manual threshold |

The values are not universal. Select settings for the actual media and printer.
An issue command may also invoke cutter/stripper behavior or automatic status
response.

### `T`, `U1`, `U2`, and `IB` — Feed and Eject

```text
{T...|}
{U1;0100|}
{U2;0100|}
{IB...|}
```

- `T` feeds media, commonly one label using the current `D` size.
- `U1` and `U2` move media forward and reverse; distance is commonly in
  0.1 mm.
- `IB` performs an eject operation on supported printers.

Sensor, distance, and peel/cutter behavior depend on model and issue state.

### Legacy `i` Issue

Some older command sets use lowercase `i`, optionally with a copy count.
Exact syntax varies; do not send it together with `XS` unless the configured
printer mode requires it.

## Status and Optional Features

### `WS` — Status Request

```text
{WS...|}
```

Requests printer status on supported interfaces, commonly serial or Ethernet.
Response format and timing vary. Handle partial responses, timeouts, and
unsolicited status data.

### Optional or Model-Specific Commands

These command families are not supported by every printer:

| Command | Common purpose |
|---|---|
| `JT` | Real-time clock setting |
| `XO`, `XV`, `XP`, `XQ`, `XT` | Save and recall formats |
| `XF`, `XE`, `XD`, `XA` | Writable-character storage |
| `J1`, `JA` | Format printer or external memory; potentially destructive |
| `WB`, `WV`, `WI`, `WG`, `WN`, `IR` | Buffer, version, memory, or printer information |
| `WR`, `Z0` | Reset or batch reset |
| `IP`, `IS`, `IH`, `IZ` | Network or internal serial configuration |
| `WF`, `{@003...|}`, `{@006...|}`, `{@012...|}` | Optional RFID operations |
| `PS` | OpenType text processing options |
| `RM`, `Z2`, `ZML00`, `HD`, `XJ` | Advanced adjustment or diagnostic functions |

Use these only when the printer supports them and the operation is understood.
Memory formatting, network changes, service adjustments, and RFID writes can
erase data, interrupt printing, or change device behavior. Date/time and
serialization are often supplied by the host; there is no single portable
command for every model.

## Complete Template Example

This example shows the order of operations in a label job: clear and size the
image, define fields, supply values, draw areas/lines, and issue. Field values
are placeholders from the supplied template.

```text
{C|}
{D0630,1040,0600|}
{AX;+000,+000,+00|}
{AY;+10,0|}
{PC001;0253,0230,10,10,G,00,B|}
{PC002;0253,0286,10,10,H,00,B|}
{PC005;0253,0037,10,10,H,00,B|}
{PC007;0863,0235,10,10,G,00,B|}
{PC008;0863,0188,10,10,G,00,B|}
{PC009;0253,0482,10,10,G,00,B|}
{PC010;0253,0532,10,10,Q,00,B|}
{PC011;0433,0584,10,10,R,00,B|}
{PC012;0033,0584,10,10,H,00,B|}
{PC013;0245,0422,10,10,H,00,B|}
{PC014;0253,0180,10,10,G,00,B|}
{PC015;0253,0211,10,10,G,00,B|}
{PC016;0253,0084,10,10,G,00,B|}
{PC017;0253,0134,10,10,R,00,B|}
{PC018;0880,0040,10,10,G,00,B|}
{PC019;0603,0408,10,10,G,00,B|}
{PC020;0603,0447,10,10,G,00,B|}
{PC021;0800,0555,10,10,G,00,B|}
{PC022;0245,0355,10,10,Q,00,B|}
{XB00;0033,0460,9,3,03,3,0200,+0000000000,000,0,00|}
{XB01;0800,0150,T,H,05,A,1|}
{XB02;1010,0055,T,H,03,A,1|}
{RB00;field01|}
{RB01;field10|}
{RB02;field08|}
{RC001;Requested Quantity|}
{RC002;field03|}
{RC005;field04|}
{RC007;field05|}
{RC008;Date|}
{RC009;field06|}
{RC010;field07|}
{RC011;|}
{RC012;field09|}
{RC013;field17|}
{RC014;field12|}
{RC016;field11|}
{RC017;field10|}
{RC018;field13|}
{RC019;field14|}
{RC020;field15|}
{RC021;field16|}
{RC022;field02|}
{XR;0241,0000,0251,0354,B|}
{XR;0589,0306,0598,0496,B|}
{LC;0842,0136,0842,0306,0,3|}
{LC;0241,0304,0596,0304,0,5|}
{LC;0590,0496,1085,0496,0,7|}
{XS;I,0001,0002C5200|}
```

`PC` defines text fields; matching `RC` commands supply text. `XB` defines
barcodes; matching `RB` commands supply their data. `XR` and `LC` draw or alter
areas. `XS` prints the label.

**Template warning:** With the common 0.1 mm coordinate interpretation, some
x positions in this template exceed the 104.0 mm effective width set by `D`.
It is an illustration, not a verified print file. Check field bounds and
printer-specific options before use.

## Before Printing

1. Confirm printer model, firmware, resolution, media, and installed options.
2. Confirm host and printer use the same brace framing.
3. Check coordinate units, label pitch/width/length, and field bounds.
4. Test text encoding, font IDs, barcode options, and scanner readability.
5. Verify issue count, sensor, speed, cut/peel behavior, and status handling.

The examples are a syntax aid, not a substitute for testing on the target
printer.
