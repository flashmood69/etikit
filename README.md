# Etikit

Etikit is a minimalistic, web-based application designed for creating and formatting labels.
It supports both TPCL and ZPL label formats.

## Features

- **Visual Label Designer**: A simple and intuitive drag-and-drop interface for designing labels.
- **Element Support**: Add and configure text elements, lines, rectangles, barcodes, and QR codes.
- **TPCL Integration**: Generates printer-ready code following the TPCL specification.
- **ZPL Integration**: Generates printer-ready code following the ZPL specification.
- **Template Management**:
  - Save and load label designs as JSON templates.
  - Import TPCL/ZPL files (`.tpcl`, `.zpl`, `.txt`) into the designer.
  - Auto-select export format based on the loaded file type.
- **Label Size Presets**: Create a new label using common industrial sizes (default: **102 × 76 mm (4" × 3")**).
- **Auto Zoom**: Fit the label to the available editor area with a single toggle.
- **Minimalistic UI**: Focused on efficiency and ease of use.

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

- Click **New** to start a new label and choose a label size preset.
- Use **Auto** in the zoom control to fit the label to the editor.
- Add elements from the left toolbar, then drag them on the label.
- Use **Load** to import a JSON template or TPCL/ZPL file.
- Pick **TPCL** or **ZPL** in the export dropdown (auto-selected after importing), then click **Export**.

### Building for Production

To create a production-ready build:
```bash
npm run build
```
The output will be in the `dist` folder.

## Disclaimer

TPCL and ZPL are proprietary protocols developed by TEC® and Zebra Technologies respectively.
This project is not affiliated with or endorsed by TEC® or Zebra Technologies.
