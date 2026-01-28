# Etikit

Etikit is a minimalistic, web-based application designed for creating and formatting labels.
It supports both TPCL and ZPL label formats with high precision.

## Features

- **Visual Label Designer**: A simple and intuitive drag-and-drop interface for designing labels.
- **Precision Alignment Tools**: 
  - Align elements to left, center, right, top, middle, or bottom.
  - Distribute multiple elements evenly (horizontally or vertically).
  - Smart handling of rotations and text baselines for pixel-perfect alignment.
- **Snap to Grid**: Toggleable grid with customizable size for precise element placement.
- **History Management**: Full Undo (Ctrl+Z) and Redo (Ctrl+Y) support for all editor actions.
- **Element Support**: Add and configure text elements, lines, rectangles, barcodes, and QR codes.
- **TPCL Integration**: Generates printer-ready code following the TPCL specification.
- **ZPL Integration**: Generates printer-ready code following the ZPL specification. Supports font sizing in dots for high precision.
- **Font Presets**: Centralized font management using driver-specific font codes.
- **Template Management**:
  - Save and load label designs as JSON templates.
  - Import TPCL/ZPL files (`.ezpl`, `.etec`) into the designer.
  - Export directly to printer-ready files with protocol-specific extensions.
- **Label Size Presets**: Choose from common industrial sizes or set custom dimensions.
- **Auto Zoom**: Fit the label to the available editor area with a single toggle.
- **Modern UI**: Streamlined interface with icon-only actions and integrated protocol indicators.

## Tech Stack

- **Framework**: [React](https://react.dev/) 19
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Components**: 
  - `react-draggable` for the designer interface.
  - `react-barcode` and `qrcode.react` for label elements.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd etikit
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

- **Creating**: Click the **+** (New) button to start a new label and choose a size preset.
- **Designing**: Add elements from the left toolbar, then drag them on the label.
- **Precision**: Use the alignment buttons in the top bar to position selected elements. Toggle the grid for snapping.
- **Editing**: Use the right sidebar to adjust properties like content, font, rotation, and size.
- **History**: Use the Undo/Redo arrows or keyboard shortcuts (Ctrl+Z / Ctrl+Y).
- **Managing**: Use **Load** (Upload icon) to import files and **Save** (Disk icon) to store templates.
- **Exporting**: Click **Export** to generate the printer-ready file. The current protocol (ZPL/TPCL) is shown directly on the button.

## Technical Notes

### ZPL Font Sizing
In the ZPL protocol, font width and height are measured in **dots** rather than points (pt) or scale factors. Etikit respects this by:
- Storing `width` and `height` as dot values for ZPL elements.
- Converting dots to millimeters (mm) and then to pixels (px) for the designer preview based on the DPI setting (default: 203 DPI).

### Font Management
To simplify templates and ensure driver consistency, Etikit uses a `fontCode` system:
- **Templates** only store the `fontCode` for text elements.
- **Drivers** (TPCL/ZPL) define the metadata (font family, weight, style) for each code.
- The **UI** resolves these properties at runtime to render the correct font in the designer.

## Building for Production

To create a production-ready build:
```bash
npm run build
```
The output will be in the `dist` folder.

## Disclaimer

TPCL and ZPL are proprietary protocols developed by TEC® and Zebra Technologies respectively.
This project is not affiliated with or endorsed by TEC® or Zebra Technologies.
