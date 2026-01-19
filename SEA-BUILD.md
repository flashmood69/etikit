# Etikit Single Executable Application (SEA) Build Guide

This document provides instructions for building the Etikit application as a Windows-compatible single executable.

## Prerequisites

- **Node.js**: v20.0.0 or later (v25.3.0 recommended)
- **Windows 10/11**: The build process and resulting executable are designed for Windows.
- **npm**: Installed with Node.js.

## Project Structure

- `sea-config.json`: SEA configuration file.
- `src/`: Application source code.
  - `src/index.js`: Node.js entry point for the SEA.
- `resources/`: Folder for static assets (copied from `dist` after build).
- `build/`: Output directory for the executable and intermediate artifacts.

## Build Process

The build process is automated via `scripts/build-sea.js`. It performs the following steps:

1. **Build Frontend**: Runs `npm run build` to compile the React application into the `dist/` folder.
2. **Prepare Resources**: Copies the contents of `dist/` to `build/resources/`.
3. **Bundle Server**: Uses `esbuild` to bundle the Node.js entry point (`src/index.js`) into a single CommonJS file (`build/index.js`).
4. **Generate Blob**: Uses Node.js to generate an SEA preparation blob from `sea-config.json`.
5. **Create Executable**: Copies the current Node.js executable to `build/etikit.exe`.
6. **Inject Blob**: Uses `postject` to inject the preparation blob into the executable's resources.
7. **Verify**: Checks if the executable was created successfully.

## How to Build

Run the following command in the project root:

```powershell
node scripts/build-sea.js
```

The resulting executable will be located at `build/etikit.exe`.

## How to Run

You can run the executable directly:

```powershell
.\build\etikit.exe
```

By default, it will start a web server at `http://localhost:3000/`. You can change the port by setting the `PORT` environment variable:

```powershell
$env:PORT=4000; .\build\etikit.exe
```

## Troubleshooting

### "SyntaxError: Cannot use import statement outside a module"
This usually happens if the input file to `node --experimental-sea-config` contains ESM `import` statements. The build script uses `esbuild` to convert the code to CommonJS before generating the blob to avoid this.

### "warning: The signature seems corrupted!"
This is normal when using `postject` on a signed Node.js executable. It means the original digital signature is no longer valid because the file has been modified. For production, you may want to re-sign the executable with your own certificate.

### Port already in use
If the server fails to start because port 3000 is occupied, set a different port using the `PORT` environment variable.
