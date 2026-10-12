# Zebra Programming Language (ZPL/ZPL II) Practical Manual

> **Disclaimer:** This is an unofficial, independently prepared reference. It
> is not authored, reviewed, approved, or endorsed by Zebra Technologies. It is
> provided as-is, without warranties of accuracy, completeness, or fitness for
> a particular purpose. ZPL support varies by printer model, firmware,
> configuration, and options; verify commands on the intended equipment before
> use. To the extent permitted by law, the author and publisher disclaim
> liability for loss or damage arising from reliance on this document. Zebra,
> ZPL, and product names belong to their respective owners.

This is a concise, example-first guide to common ZPL commands. The command
index at the end retains the broader command list; it is not a guarantee that
every listed feature is available on every printer.

## Contents

- [What ZPL Does](#what-zpl-does)
- [Format Structure](#format-structure)
- [Coordinates and Label Size](#coordinates-and-label-size)
- [Text](#text)
- [Barcodes](#barcodes)
- [Lines and Graphics](#lines-and-graphics)
- [Variables and Serialization](#variables-and-serialization)
- [Printing and Media](#printing-and-media)
- [Data Characters and Hexadecimal Input](#data-characters-and-hexadecimal-input)
- [Complete Example](#complete-example)
- [Model and Firmware Notes](#model-and-firmware-notes)
- [Command Index](#command-index)
- [RFID Commands](#rfid-commands)
- [Wireless Commands](#wireless-commands)
- [Font Quick Reference](#font-quick-reference)

## What ZPL Does

ZPL is a command language for describing label formats. The host sends a
sequence of commands that sets label dimensions, places fields, supplies
field data, and ends the format for printing.

Unlike TPCL brace-framed commands, ZPL uses command prefixes:

- `^` introduces most format commands.
- `~` introduces many immediate or printer-control commands.
- Parameters are commonly comma-separated.
- `^FD` starts field data; `^FS` ends that field.

The default prefixes can be changed with commands such as `^CC` and `^CT`.
Examples here assume the defaults.

## Format Structure

Every ordinary label format starts with `^XA` and ends with `^XZ`:

```text
^XA
...format commands and fields...
^XZ
```

`^XZ` closes the format and normally causes it to print. A format can contain
multiple fields. Commands are concatenated; line breaks in examples are only
for readability and are not required between commands.

## Coordinates and Label Size

ZPL field positions and dimensions are in **printer dots**, not millimetres.
The physical size of a dot depends on the printhead resolution.

| Resolution | Approximate dots per mm | Approximate dots per inch |
|---|---:|---:|
| 203 dpi | 8 | 203 |
| 300 dpi | 12 | 300 |
| 600 dpi | 24 | 600 |

Convert millimetres to dots using the printer's resolution. For example, a
100 mm-wide label is about 800 dots wide at 203 dpi and 1,200 dots at 300 dpi.

Set the print area and origin explicitly:

```text
^PW812
^LL1218
^LH0,0
```

| Command | Purpose |
|---|---|
| `^PW` | Set print width in dots. |
| `^LL` | Set label length in dots. |
| `^LH` | Set the label-home reference point. |
| `^FOx,y` | Place a field from its origin. |
| `^FTx,y` | Place a field using its typeset/baseline position. |

`^LH` affects commands that follow it. Keep coordinates within the configured
print area; dimensions and available resolution depend on the printer.

## Text

Place a field, select a font, provide its data, and close it:

```text
^FO40,40
^A0N,40,32
^FDShipment 12345^FS
```

- `^FO40,40` positions the field at x=40, y=40 dots.
- `^A0N,40,32` selects font 0, normal orientation, 40-dot height, and
  32-dot width.
- `^FD` begins field data; `^FS` ends the field.

Common text commands:

| Command | Purpose |
|---|---|
| `^A` | Select a font, orientation, height, and width for a field. |
| `^CF` | Set the default alphanumeric font and size. |
| `^FO` | Set a field origin. |
| `^FT` | Set a field typeset/baseline position. |
| `^FB` | Format text into a block with width, line count, spacing, and alignment. |
| `^FR` | Reverse-print a field. |
| `^CI` | Select character encoding; availability and supported encodings vary. |

Example with a wrapped text block:

```text
^FO40,110^A0N,28,28
^FB600,3,4,L,0
^FDFragile item - handle with care.^FS
```

Font identifiers and installed fonts differ by printer. Downloadable fonts and
font linking require compatible memory, firmware, and font files.

## Barcodes

Set field position, configure the symbology, then supply the payload:

```text
^FO40,220
^BY2,2,70
^BCN,70,Y,N,N
^FD123456789012^FS
```

`^BC` selects Code 128; `^BY` sets common one-dimensional barcode defaults.
The supported options and acceptable payload depend on the symbology and
printer firmware.

Common barcode commands:

| Command | Symbology |
|---|---|
| `^BC` | Code 128 |
| `^B3` | Code 39 |
| `^B2` | Interleaved 2 of 5 |
| `^BE` | EAN-13 |
| `^BU` | UPC-A |
| `^B7` | PDF417 |
| `^BQ` | QR Code |
| `^BX` | Data Matrix |
| `^B0` / `^BO` | Aztec Code; both forms are documented on compatible firmware. |

Example QR Code (Model 2, magnification 6):

```text
^FO40,340
^BQN,2,6
^FDLA,ITEM-12345^FS
```

For QR Code, the field data includes an error-correction level and input-mode
switch before the payload. Here `L` selects an error-correction level and
`A,` selects automatic data input. Confirm the QR settings and payload
encoding for the target printer.

Barcodes must be verified with a scanner on the actual printer, media, and
print speed. Quiet zones, module size, contrast, and payload limits matter.

## Lines and Graphics

Use `^GB` for boxes and lines; `^GC` and `^GD` draw circles and diagonal lines.

```text
^FO40,470^GB700,3,3^FS
^FO40,500^GB300,120,4,B,0^FS
```

The first example draws a horizontal line. The second draws a rectangular box.
Dimensions and border thickness are in dots. `^GF` and `~DG` support bitmap
graphics; downloaded graphics and storage devices are model-dependent.

## Variables and Serialization

For stored formats, `^FN` identifies a field that can be supplied when the
format is recalled. `^DF` stores a format and `^XF` recalls it. These commands
are useful when a fixed layout is reused with changing values.

`^SN` can increment a serial value across printed labels:

```text
^FO40,660^A0N,30,30
^SN0001,1,Y^FS
```

This starts at `0001`, increments by one, and requests serialization. Exact
counter behavior and persistence depend on the printer and job settings.

## Printing and Media

| Command | Purpose |
|---|---|
| `^PQ` | Set print quantity and optional replicate and pause behavior. |
| `^PR` | Set print speed and related rate options. |
| `^MD` | Adjust media darkness. |
| `^MM` | Select print mode, such as tear-off, peel, or cutter where supported. |
| `^MN` | Select media tracking/sensing behavior. |
| `~HS` | Request host status on supported interfaces. |

Example for a quantity of one:

```text
^PQ1
```

Media modes, sensor settings, cutter/peeler behavior, speed, and darkness are
printer- and stock-dependent. Validate settings rather than assuming a value
will transfer between models.

## Data Characters and Hexadecimal Input

Commas, semicolons, and square brackets are ordinary field data in `^FD`;
they are not ZPL command delimiters. The default command prefixes `^` and `~`
are not ordinary field characters, and `^FS` ends the field.

Use `^FH` when field data needs byte values entered in hexadecimal. Its default
indicator is underscore; each indicator must be followed by two hex digits:

```text
^FO40,760^A0N,28,28
^FH_^FDLiteral caret: _5E, tilde: _7E, command-like text: _5EFS^FS
```

Here `_5E` inserts byte `5E` (caret), `_7E` inserts byte `7E` (tilde), and
`_5EFS` prints the literal text `^FS` without ending the field early. `^FH`
applies to the following field-data command; place it before each `^FD` that
uses hexadecimal values. The indicator can be changed with the `^FH`
parameter.

`^FH` is a field-data encoding mechanism, not a way to escape arbitrary
commands or malformed formats. Character encoding and high-bit bytes should
be tested with the selected `^CI` mode and printer firmware.

## Complete Example

This example targets a nominal 4 x 6 inch label on a 203 dpi printer
(approximately 812 x 1218 dots):

```text
^XA
^PW812
^LL1218
^LH0,0
^FO40,40^A0N,40,32^FDShipment 12345^FS
^FO40,105^A0N,28,28^FB650,2,4,L,0^FDDeliver to: Receiving^FS
^FO40,220^BY2,2,70^BCN,70,Y,N,N^FD123456789012^FS
^FO40,340^BQN,2,6^FDLA,ITEM-12345^FS
^FO40,500^GB700,3,3^FS
^PQ1
^XZ
```

Before sending a production job, check the printer's resolution, label
dimensions, media tracking, installed fonts, and support for the selected
barcode commands.

## Model and Firmware Notes

- ZPL and ZPL II features vary across printer generations and firmware.
- RFID, wireless, network, storage, font-download, and some barcode commands
  require specific hardware or firmware.
- Defaults and settings may persist between jobs. Set important label geometry
  and field options explicitly.
- The command index below is a broad inventory, not a compatibility promise.

## Command Index

The following compact index retains the commands from the supplied list.
Parameter letters are placeholders; consult the specific printer's command
support and syntax before sending a command.

### General Command List

| Command | Format | Description |
| ------- | ------ | ----------- |
| ^A | ^Afo,h,w,d:f.x | Use Scalable/Bitmapped Font |
| ^A@ | ^A@o,h,w,d:f.x | Use Font Name to Call Font |
| ^B0 | ^B0a,b,c,d,e,f,g | Aztec Bar Code Parameters |
| ^B1 | ^B1o,e,h,f,g | Code 11 Bar Code |
| ^B2 | ^B2o,h,f,g,e,j | Interleaved 2 of 5 Bar Code |
| ^B3 | ^B3o,e,h,f,g | Code 39 Bar Code |
| ^B4 | ^B4o,h,f,m | Code 49 Bar Code |
| ^B5 | ^B5o,h,f,g | Planet Code bar code |
| ^B7 | ^B7o,h,s,c,r,t | PDF417 Bar Code |
| ^B8 | ^B8o,h,f,g | EAN-8 Bar Code |
| ^B9 | ^B9o,h,f,g,e | UPC-E Bar Code |
| ^BA | ^BAo,h,f,g,e | Code 93 Bar Code |
| ^BB | ^BBo,h,s,c,r,m | CODABLOCK Bar Code |
| ^BC | ^BCo,h,f,g,e,m | Code 128 Bar Code (Subsets A, B, and C) |
| ^BD | ^BDm,n,t | UPS MaxiCode Bar Code |
| ^BE | ^BEo,h,f,g | EAN-13 Bar Code |
| ^BF | ^BFo,h,m | MicroPDF417 Bar Code |
| ^BI | ^BIo,h,f,g | Industrial 2 of 5 Bar Codes |
| ^BJ | ^BJo,h,f,g | Standard 2 of 5 Bar Code |
| ^BK | ^BKo,e,h,f,g,k,l | ANSI Codabar Bar Code |
| ^BL | ^BLo,h,g | LOGMARS Bar Code |
| ^BM | ^BMo,e,h,f,g,e2 | MSI Bar Code |
| ^BO | ^BOa,b,c,d,e,f,g | Aztec Bar Code Parameters |
| ^BP | ^BPo,e,h,f,g | Plessey Bar Code |
| ^BQ | ^BQa,b,c,d,e | QR Code Bar Code |
| ^BR | ^BRa,b,c,d,e,f | GS1 Databar |
| ^BS | ^BSo,h,f,g | UPC/EAN Extensions |
| ^BT | ^BTo,w1,r1,h1,w2,h2 | TLC39 Bar Code |
| ^BU | ^BUo,h,f,g,e | UPC-A Bar Code |
| ^BX | ^BXo,h,s,c,r,f,g,a | Data Matrix Bar Code |
| ^BY | ^BYw,r,h | Bar Code Field Default |
| ^BZ | ^BZo,h,f,g,t | POSTAL Bar Code |
| ^CC | ^CCx or ~CCx | Change Caret (Alt. ~CC) |
| ^CD | ^CDa or ~CDa | Change Delimiter (Alt. ~CD) |
| ^CF | ^CFf,h,w | Change Alphanumeric Default Font |
| ^CI | ^CIa,s1,d1,s2,d2,... | Change International Font/Encoding |
| ^CM | ^CMa,b,c,d | Change Memory Letter Designation |
| ^CN | ^CNa | Cut Now |
| ^CO | ^COa,b,c | Cache On |
| ^CP | ^CPa | Remove Label |
| ^CT | ^CTa or ~CTa | Change Tilde (Alt. ~CT) |
| ^CV | ^CVa | Code Validation |
| ^CW | ^CWa,d:o.x | Font Identifier |
| ~DB | ~DBd:o.x,a,h,w,base,space,#char,©,data | Download Bitmap Font |
| ~DE | ~DEd:o.x,s,data | Download Encoding |
| ^DF | ^DFd:o.x | Download Format |
| ~DG | ~DGd:o.x,t,w,data | Download Graphics |
| ~DN | ~DN | Abort Download Graphic |
| ~DS | ~DSd:o.x,s,data | Download Intellifont (Scalable Font) |
| ~DT | ~DTd:o.x,s,data | Download Bounded TrueType Font |
| ~DU | ~DUd:o.x,s,data | Download Unbounded TrueType Font |
| ~DY | ~DYd:f,b,x,t,w,data | Download Objects |
| ~EG | ~EG or ^EG | Erase All Graphics (Alt. ^EG) |
| ^FB | ^FBa,b,c,d,e | Field Block |
| ^FC | ^FCa,b,c | Field Clock |
| ^FD | ^FDa | Field Data |
| ^FH | ^FHa | Field Hexadecimal Indicator |
| ^FL | ^FL<ext>,<base>,<link> | Font Linking |
| ^FM | ^FMx1,y1,x2,y2,... | Multiple Field Origin Locations |
| ^FN | ^FN#"a" | Field Number |
| ^FO | ^FOx,y,z | Field Origin |
| ^FP | ^FPd,g | Field Parameter |
| ^FR | ^FR | Field Reverse Print |
| ^FS | ^FS | Field Separator |
| ^FT | ^FTx,y,z | Field Typeset |
| ^FV | ^FVa | Field Variable |
| ^FW | ^FWr,z | Field Orientation |
| ^FX | ^FXc | Comment |
| ^GB | ^GBw,h,t,c,r | Graphic Box |
| ^GC | ^GCd,t,c | Graphic Circle |
| ^GD | ^GDw,h,t,c,o | Graphic Diagonal Line |
| ^GE | ^GEw,h,t,c | Graphic Ellipse |
| ^GF | ^GFa,b,c,d,data | Graphic Field |
| ^GS | ^GSo,h,w | Graphic Symbol |
| ~HB | ~HB | Return Battery Status |
| ~HD | ~HD | Return Head Diagnostic |
| ^HF | ^HFd,o,x | Return Host Format |
| ^HG | ^HGd:o.x | Return Host Graphic |
| ^HH | ^HH | Return Configuration Label |
| ~HI | ~HI | Return Host Identification |
| ~HM | ~HM | Return Host RAM Status |
| ~HQ | ~HQquery-type | Return Host Query |
| ~HS | ~HS | Return Host Status |
| ~HU | ~HU | Return ZebraNet Alert Configuration |
| ^HV | ^HV#,n,h,t,a | Return Host Verification |
| ^HW | ^HWd:o.x | Return Host Directory List |
| ^HY | ^HYd:o.x | Upload Graphics |
| ^HZ | ^HZb | Display Description Information |
| ^HZ | ^HZO,d:o.x,l | Display Description Information |
| ^ID | ^IDd:o.x | Object Delete |
| ^IL | ^ILd:o.x | Image Load |
| ^IM | ^IMd:o.x | Image Move |
| ^IS | ^ISd:o.x,p | Image Save |
| ~JA | ~JA | Cancel All |
| ^JB | ^JBa | Initialize Flash Memory |
| ~JB | ~JB | Reset Optional Memory |
| ~JC | ~JC | Set Media Sensor Calibration |
| ~JD | ~JD | Enable Communications Diagnostics |
| ~JE | ~JE | Disable Diagnostics |
| ~JF | ~JFp | Set Battery Condition |
| ~JG | ~JG | Graphing Sensor Calibration |
| ^JH | ^JHa,b,c,d,e,f,g,h,i,j | Early Warning Settings |
| ^JI | ^JId:o.x,b,c,d | Start Zebra BASIC Interpreter |
| ~JI | ~JI | Start Zebra BASIC Interpreter |
| ^JJ | ^JJa,b,c,d,e,f | Set Auxiliary Port |
| ~JK | ~JK | Delayed Cut |
| ~JL | ~JL | Set Label Length |
| ^JM | ^JMn | Set Dots per Millimeter |
| ~JN | ~JN | Head Test Fatal |
| ~JO | ~JO | Head Test Non-Fatal |
| ~JP | ~JP | Pause and Cancel Format |
| ~JQ | ~JQ | Terminate Zebra BASIC Interpreter |
| ~JR | ~JR | Power On Reset |
| ^JS | ^JSa | Sensor Select |
| ~JS | ~JSb | Change Backfeed Sequence |
| ^JT | ^JT####,a,b,c | Head Test Interval |
| ^JU | ^JUa | Configuration Update |
| ^JW | ^JWt | Set Ribbon Tension |
| ~JX | ~JX | Cancel Current Partially Input Format |
| ^JZ | ^JZa | Reprint After Error |
| ~KB | ~KB | Kill Battery (Battery Discharge Mode) |
| ^KD | ^KDa | Select Date and Time Format (for Real Time |
| ^KL | ^KLa | Define Language |
| ^KN | ^KNa,b | Define Printer Name |
| ^KP | ^KPa,b | Define Password |
| ^KV | ^KVa,b,c,d,e | Kiosk Values |
| ^LF | ^LF | Print Font Links |
| ^LH | ^LHx,y | Label Home |
| ^LL | ^LLy | Label Length |
| ^LR | ^LRa | Label Reverse Print |
| ^LS | ^LSa | Label Shift |
| ^LT | ^LTx | Label Top |
| ^MA | ^MAtype,print,threshold,frequency,units | Set Maintenance Alerts |
| ^MC | ^MCa | Map Clear |
| ^MD | ^MDa | Media Darkness |
| ^MF | ^MFp,h | Media Feed |
| ^MI | ^MItype,message | Set Maintenance Information Message |
| ^ML | ^MLa | Maximum Label Length |
| ^MM | ^MMa,b | Print Mode |
| ^MN | ^MNa,b | Media Tracking |
| ^MP | ^MPa | Mode Protection |
| ^MT | ^MTa | Media Type |
| ^MU | ^MUa,b,c | Set Units of Measurement |
| ^MW | ^MWa | Modify Head Cold Warning |
| ^NC | ^NCa | Select the Primary Network Device |
| ~NC | ~NC### | Network Connect |
| ^ND | ^NDa,b,c,d,e,f,g,h,i,j | Change Network Settings |
| ^NI | ^NI### | Network ID Number |
| ~NR | ~NR | Set All Network Printers Transparent |
| ^NS | ^NSa,b,c,d,e,f,g,h,i | Change Wired Networking Settings |
| ~NT | ~NT | Set Currently Connected Printer Transparent |
| ^PA | ^PAa,b,c,d | Advanced Text Properties |
| ^PF | ^PF# | Slew Given Number of Dot Rows |
| ^PH | ^PH or ~PH | Slew to Home Position (Alt. ~PH) |
| ~PL | ~PLa | Present Length Addition |
| ^PM | ^PMa | Printing Mirror Image of Label |
| ^PN | ^PNa | Present Now |
| ^PO | ^POa | Print Orientation |
| ^PP | ^PP or ~PP | Programmable Pause (Alt. ~PP) |
| ^PQ | ^PQq,p,r,o,e | Print Quantity |
| ~PR | ~PR | Applicator Reprint |
| ^PR | ^PRp,s,b | Print Rate |
| ~PS | ~PS | Print Start |
| ^PW | ^PWa | Print Width |
| ~RO | ~ROc | Reset Advanced Counters |
| ^SC | ^SCa,b,c,d,e,f | Set Serial Communications |
| ~SD | ~SD## | Set Darkness |
| ^SE | ^SEd:o.x | Select Encoding Table |
| ^SF | ^SFa,b | Serialization Field (with a Standard ^FD |
| ^SI | ^SIa,b | Set Sensor Intensity |
| ^SL | ^SLa,b | Set Mode and Language (for Real-Time Clock) |
| ^SN | ^SNv,n,z | Serialization Data |
| ^SO | ^SOa,b,c,d,e,f,g | Set Offset (for Real-Time Clock) |
| ^SP | ^SP# | Start Print |
| ^SQ | ^SQa,b,c | Halt ZebraNet Alert |
| ^SR | ^SR#### | Set Printhead Resistance |
| ^SS | ^SSw,m,r,l,m2,r2,a,b,c | Set Media Sensors |
| ^ST | ^STa,b,c,d,e,f,g | Set Date and Time (for Real-Time Clock) |
| ^SX | ^SXa,b,c,d,e,f | Set ZebraNet Alert |
| ^SZ | ^SZa | Set ZPL Mode |
| ~TA | ~TA### | Tear-off Adjust Position |
| ^TB | ^TBa,b,c | Text Blocks |
| ^TO | ^TOs:o.x,d:o.x | Transfer Object |
| ~WC | ~WC | Print Configuration Label |
| ^WD | ^WDd:o.x | Print Directory Label |
| ~WQ | ~WQquery-type | Write Query |
| ^XA | ^XA | Start Format |
| ^XB | ^XB | Suppress Backfeed |
| ^XF | ^XFd:o.x | Recall Format |
| ^XG | ^XGd:o.x,mx,my | Recall Graphic |
| ^XS | ^XSlength,threshold | Set Dynamic Media Calibration |
| ^XZ | ^XZ | End Format |
| ^ZZ | ^ZZt,b | Printer Sleep |


### RFID Commands

| Command | Format | Description |
| ------- | ------ | ----------- |
| ^HL | ^HL or ~HL | Return RFID Data Log to Host (Alt. ~HL) |
| ^HR | ^HRa,b,c,d,e | Calibrate RFID Tag Position |
| ^RA | ^RA#,f,r,m,b | Read AFI or DSFID Byte |
| ^RB | ^RBn,p0,p1,p2, ..., p15 | Define EPC Data Structure |
| ^RE | ^REt,r | Enable/Disable E.A.S. Bit |
| ^RF | ^RFo,f,b,n,m | Read or Write RFID Format |
| ^RI | ^RIa,b,c,d | Get RFID Tag ID |
| ^RL | ^RLM,k,a,e,u | Lock/Unlock RFID Tag Memory |
| ^RL | ^RLB,s,n | Lock/Unlock RFID Tag Memory |
| ^RM | ^RMe | Enable RFID Motion |
| ^RN | ^RNe | Detect Multiple RFID Tags in Encoding Field |
| ^RQ | ^RQf,c,o[data] | Quick Write EPC Data and Passwords |
| ^RR | ^RRn,a | Specify RFID Retries for a Block or Enable |
| ^RS | ^RSt,p,v,n,e,a,c,s | Set Up RFID Parameters |
| ^RT | ^RT#,b,n,f,r,m,s | Read RFID Tag |
| ^RU | ^RUa,b | Read Unique RFID Chip Serialization |
| ~RV | ~RVa | Report RFID Encoding Results |
| ^RW | ^RWr,w,a | Set RF Power Levels for Read and Write |
| ^RZ | ^RZp,m,l | Set RFID Tag Password and Lock Tag |
| ^WF | ^WFr,m,w,f,b | Encode AFI or DSFID Byte |
| ^WT | ^WTb,r,m,w,f,v | Write (Encode) Tag |
| ^WV | ^WVe | Verify RFID Encoding Operation |


### Wireless Commands

| Command | Format | Description |
| ------- | ------ | ----------- |
| ^KC | ^KCa,b,c,d | Set Client Identifier (Option 61) |
| ^NB | ^NBa | Search for Wired Print Server during |
| ^NN | ^NNa,b,c,d,e,f | Set SNMP |
| ^NP | ^NPa | Set Primary/Secondary Device |
| ^NT | ^NTa,b | Set SMTP |
| ^NW | ^NWa | Set Web Authentication Timeout Value |
| ^WA | ^WAa,b | Set Antenna Parameters |
| ^WE | ^WEa,b,c,d,e,f,g,h | Set WEP Mode |
| ^WI | ^WIa,b,c,d,e,f,g,h,i | Change Wireless Network Settings |
| ^WL | ^WLa,b,c | Set LEAP Parameters |
| ~WL | ~WL | Print Network Configuration Label |
| ^WP | ^WPa,b | Set Wireless Password |
| ^WR | ^WRa,b,c,d,e | Set Transmit Rate |
| ~WR | ~WR | Reset Wireless Radio Card and Print Server |
| ^WS | ^WSe,o,p,h,i,j,k | Set Wireless Radio Card Values |
| ^WX | ^WXa,... | Configure Wireless Securities |
| ^WX | ^WX01 | Configure Wireless Securities |
| ^WX | ^WX02,b,c,d,e,f,g,h | Configure Wireless Securities |
| ^WX | ^WX03,b,c,d,e,f,g,h | Configure Wireless Securities |
| ^WX | ^WX04,k | Configure Wireless Securities |
| ^WX | ^WX05,i,j | Configure Wireless Securities |
| ^WX | ^WX06,i,j,k | Configure Wireless Securities |
| ^WX | ^WX07,i,j | Configure Wireless Securities |
| ^WX | ^WX08,i,j | Configure Wireless Securities |
| ^WX | ^WX09,n | Configure Wireless Securities |
| ^WX | ^WX10,k | Configure Wireless Securities |
| ^WX | ^WX11,i,j | Configure Wireless Securities |
| ^WX | ^WX12,i,j,k | Configure Wireless Securities |
| ^WX | ^WX13,i,j | Configure Wireless Securities |
| ^WX | ^WX14,i,j | Configure Wireless Securities |
| ^WX | ^WX15,i,j,l,m | Configure Wireless Securities |

### Font Quick Reference

The following typeface comparisons are approximate. Resident fonts, aliases,
and downloadable fonts vary by printer.

| **ZPL Font Code** | **Zebra Name** | **Closest Real Typeface Equivalent** | **Notes** |
|------------------|----------------|--------------------------------------|-----------|
| **A** | Standard | Similar to **Courier** (monospaced) | Basic mono font, not Courier New but similar proportions |
| **B** | Bold | Heavy **Courier-like** | Same family as A, thicker strokes |
| **C** | OCR-B | **OCR-B** | Industry standard OCR font |
| **D** | OCR-A | **OCR-A** | Industry standard OCR font |
| **E** | Sans Serif Medium | Similar to **Helvetica** / **Arial** | Zebra’s internal bitmap version |
| **F** | Sans Serif Bold | Similar to **Helvetica Bold** | Bitmap, heavier |
| **G** | Sans Serif Extra Bold | Similar to **Helvetica Black** | Very heavy |
| **H** | Sans Serif Ultra Bold | Similar to **Helvetica Ultra Black** | Thickest sans-serif bitmap |
| **GS** | Large | Custom Zebra bitmap | No direct desktop equivalent |
| **P** | Proportional | Similar to **Times** (serif) | Light serif, not exactly Times New Roman |
| **Q** | Proportional Bold | Similar to **Times Bold** | Bold serif bitmap |
| **R** | Serif | Similar to **Times Roman** | Classic serif |
| **S** | Serif Bold | Similar to **Times Roman Bold** | Bold serif |
| **T** | Typewriter | Similar to **Courier** | Monospaced typewriter style |
| **U** | Ultra-Thin | Custom Zebra bitmap | No real-world equivalent |
| **V** | Very Large | Custom Zebra bitmap | No real-world equivalent |
| **0** | **CG Triumvirate Bold Condensed** | **Helvetica Bold Condensed** | This is the *only scalable* built-in font |
