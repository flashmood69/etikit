# Etikit

Etikit is a minimalistic, web-based application designed for creating and formatting labels.
It leverages the **TPCL** (TEC® Printer Control Language) protocol to ensure accurate label generation.

## Features

- **Visual Label Designer**: A simple and intuitive drag-and-drop interface for designing labels.
- **Element Support**: Add and configure text elements, lines, barcodes, and QR codes.
- **TPCL Integration**: Generates printer-ready code following the TPCL specification.
- **Template Management**: Save and load label designs as JSON templates.
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

### Building for Production

To create a production-ready build:
```bash
npm run build
```
The output will be in the `dist` folder.

## Disclaimer

TPCL is a proprietary protocol and this project is not affiliated with its legitimate owner.
