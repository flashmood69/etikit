# TPCL Command Cheat‑Sheet

> This document is a **synthetic, developer‑friendly summary**.

---

## 1. What this protocol is
The host sends *commands* that define:

1. **Label geometry** (size, pitch, print area)
2. **Fields** (text, barcodes, lines, graphics)
3. **Field data** (optional separate data commands)
4. **Print/issue** action

Many commands are “format commands” (define a field) followed by matching “data commands” (supply the text/barcode data for that field).

---

## 2. Message framing & parsing

### 2.1 Special Function Control Code (SFCC)
Printers can be configured to detect TGL commands by a **start code (SFCC)** plus **separator** and **terminator** characters. The common default is:

- **SFCC**: `0x7B` → `{`
- **Separator**: `0x7C` → `|`
- **Terminator**: `0x7D` → `}`

The attached template uses the “brace” style framing.

> ✅ Practical rule: treat each command as `{CMD … }` (with parameters after the command).

### 2.2 Command structure
A command is typically:

```text
{<CMD><field?>;<param1>,<param2>,...,<paramN>}
```

- `<CMD>` is usually **1–2 characters** (e.g., `C`, `D`, `PC`, `XB`, `LC`, `XR`, `XS`).
- Some commands include a **field number** immediately after the command (e.g., `PC022`, `XB01`). This lets later “data” commands target the same field (e.g., `RC022`, `RB01`).

---

## 3. Coordinate system, units, and page orientation

### 3.1 Units
For the drawing space (text placement, barcodes, lines, rectangles, clear areas), coordinates are specified in **1/10 mm units** (0.1 mm).

Example: `0253` means **25.3 mm**.

### 3.2 Origin and axes
The manual confirms coordinates are provided in 1/10 mm for the drawing space; the **physical origin** (0,0) depends on printer mechanics and configuration (alignment/shift menus).

### 3.3 Page alignment
Printers may apply **page alignment** (Center / Left / Right) to the entire image. In portrait mode, “left/right” may appear flipped relative to the operator depending on whether the label exits top‑first or bottom‑first.

---

## 4. Core label setup commands

### 4.1 `C` — Image Buffer Clear
Clears the image buffer (start each label with a clean canvas).

### 4.2 `D` — Label Size Set
Defines label geometry in **0.1 mm** units:

- **pitch** (movement per label on continuous media)
- **effective print width**
- **effective print length**

Example:

```text
{D0630,1040,0600}
```

Interpretation:
- Pitch = 63.0 mm
- Effective print width = 104.0 mm
- Effective print length = 60.0 mm

### 4.3 `D..E` — Label Length Set (legacy)
Defines label pitch and gap length (0.1 mm), **not the label width**.

---

## 5. Fine adjustments & density

### 5.1 `AX` — Position Fine Adjustment
Configures the feed, cut/strip, and back‑feed distances.

### 5.2 `AY` — Print Density Fine Adjustment
Adjusts print density/intensity.

### 5.3 `AR` — Pre‑Feed
Sets a pre‑feed length in successive mode.

---

## 6. Text fields

There are two text systems:

- **Bitmap fonts** (`PC` format + `RC` data)
- **Outline/scalable fonts** (`PV` format + `RV` data)

### 6.1 `PC` — Bitmap Font Format (field definition)
`PC` defines a bitmap text field at a coordinate with a chosen **Font ID** and attributes. The manual also notes that **expansion** and **reverse** attributes can be applied.

#### Bitmap Font IDs

| Font ID | Font | Style | Nominal size |
|---|---|---|---|
| A | Times Roman | medium | 8 pt |
| B | Times Roman | medium | 10 pt |
| C | Times Roman | bold | 10 pt |
| D | Times Roman | bold | 12 pt |
| E | Times Roman | bold | 14 pt |
| F | Times Roman | italic | 12 pt |
| G | Helvetica | medium | 6 pt |
| H | Helvetica | medium | 10 pt |
| I | Helvetica | medium | 12 pt |
| J | Helvetica | bold | 12 pt |
| K | Helvetica | bold | 14 pt |
| L | Helvetica | italic | 12 pt |
| M | Presentation | bold | 18 pt |
| N | Letter Gothic | medium | 9.5 pt |
| O | Prestige Elite | medium | 7 pt |
| P | Prestige Elite | medium | 10 pt |
| Q | Courier | medium | 10 pt |
| R | Courier | bold | 12 pt |
| S | OCR‑A | – | 12 pt |
| T | OCR‑B | – | 12 pt |

#### Reading a `PC` line from the template

Example:

```text
{PC022;0245,0355,10,10,Q,00,B}
```

From the template we can safely interpret:

- `PC022` → bitmap text field **#022**
- `0245,0355` → position **(24.5 mm, 35.5 mm)**
- `10,10` → X/Y expansion factors (template uses `10` consistently)
- `Q` → Font ID = **Courier medium 10 pt**
- remaining parameters (`00,B`) → attribute/orientation flags (**mapping unknown**)

### 6.2 `RC` — Bitmap Font Data (field content)
Supplies data for a bitmap font field configured by `PC`.

- `RCnnn` targets the matching `PCnnn`.

Example:

```text
{RC022;champ2}
```

### 6.3 `PV` / `RV` — Outline Font Format & Data
`PV` defines a scalable (outline) text field. The font size is configured in **0.1 mm units**; data can be inline or supplied via `RV`.

Some scalable fonts (Font‑ID **H, I, J**) may require downloading a TrueType font into printer flash first.

---

## 7. Barcodes

### 7.1 `XB` — Barcode Format (field definition)
Defines a barcode field at a coordinate with parameters for bar/space sizing and barcode options.

Supported barcode types include:

- `3` → CODE39 (standard)
- `9` → CODE128 (auto code selection)
- `P` → PDF417
- `Q` → Data Matrix
- `T` → QR

### 7.2 `RB` — Barcode Data (field content)
Supplies the payload for the barcode field configured by `XB`.

Example:

```text
{XB01;0800,0150,T,H,05,A,1}
{RB01;champ10}
```

Here, `T` indicates **QR**. The remaining parameters are barcode‑specific options (orientation, model, error correction, etc.).

---

## 8. Lines, boxes, and clearing areas

### 8.1 `LC` — Line Format
Draws lines or squares in the drawing space.

- Coordinates are in **0.1 mm**.
- Squares can have rounded corners; with a large enough radius, circles can be drawn.

Example (two‑point line):

```text
{LC;0842,0136,0842,0306,0,3}
```

The first four values represent two points `(x1,y1,x2,y2)`.

### 8.2 `XR` — Clear Area
Clears or inverts a rectangular area (0.1 mm units).

Example:

```text
{XR;0241,0000,0251,0354,B}
```

---

## 9. Graphics

### 9.1 `SG` — Graphic
Draws a graphic at a location/size specified in 0.1 mm units. Six graphic modes are supported (overwrite/OR variants and multiple encodings).

> A configuration item **Image Scale** can scale graphics to match TEC output (306 dpi → 300 dpi).

### 9.2 `SG0` / `SG1` — Legacy Graphic
Older TEC‑style graphic commands where width/height are specified in multiples of 8 dots.

### 9.3 `XD` — Bitmap Writable Character
Downloads bitmap characters/logos to flash; printable later via `PC/RC`.

---

## 10. Media movement & printing

### 10.1 `T` — Feed
Feeds one label based on the `D` size (parameters may specify feed speed and sensor).

### 10.2 `U1` / `U2` — Forward/Reverse Feed
Moves media forward (`U1`) or reverse (`U2`) by a distance in 0.1 mm units.

### 10.3 `IB` — Eject
Ejects the current label.

### 10.4 `XS` — Issue (print)
Prints the label. Parameters configure print settings (speed, sensor type, copy count). Some printers can enable **Auto Status Response** via an `XS` parameter.

### 10.5 `i` / `iN` — Legacy Issue
Legacy print command with optional copy count.

---

## 11. Status and host communication

### 11.1 `WS` — Status Request
Requests printer status back to the host (serial/Ethernet only).

---

## 12. Full example (template) — annotated

### 12.1 Raw template example

```tpl
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

### 12.2 How to read this template

1. **Initialize & define label**
   - `{C}` clears the canvas.
   - `{D...}` sets pitch/width/length.
   - `{AX...}` and `{AY...}` tweak feed positions and print intensity.

2. **Define all fields**
   - `PC###` defines text fields.
   - `XB##` defines barcode fields.
   - `LC` draws lines.
   - `XR` clears areas (often used as “white rectangles” behind content).

3. **Fill the fields**
   - `RC###` provides the text for each `PC###`.
   - `RB##` provides barcode payloads for each `XB##`.

4. **Print**
   - `XS` issues/prints the label.

