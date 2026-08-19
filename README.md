# Synclet CLI (formerly ConfigMesh)

Synclet comes with a companion CLI tool that you can deploy to your server or run on your macOS machine. The CLI provides powerful automation capabilities for syncing your configuration files across your infrastructure.

Get the Synclet macOS app at https://synclet.dev

> **Note:** ConfigMesh is now Synclet. As of **2.0.0** the CLI ships as the
> [`synclet`](https://www.npmjs.com/package/synclet) npm package and a `synclet`
> binary, from this repository (`dvcrn/synclet-cli`, formerly `dvcrn/configmesh-cli`).
>
> The old `configmesh` npm package is deprecated and stays at 1.2.0. To move over:
>
> ```bash
> npm uninstall -g configmesh
> npm install -g synclet
> ```
>
> Nothing else needs to change. Your existing `~/.config/configmesh` directory is
> still used as-is, the `CONFIGMESH_*` environment variables still work, and
> `--configmesh-url` / `--configmesh-token` / `--backend configmesh` remain
> accepted as deprecated aliases for their `synclet` equivalents.

## Installation

Install the Synclet CLI globally via npm:

```bash
npm install -g synclet
```

This downloads a prebuilt binary at install time.

## Authentication

Before using Synclet, you need to authenticate:

```bash
synclet auth login
```

or if you use dropbox:

```
synclet auth dropbox login
```

This command will open your browser to complete the login process.

## Configuration

Set up a new configuration or pull existing configurations from remote:

### Initialize New Configuration

```bash
synclet config init
```

Creates a new configuration bundle in the current directory.

### Pull Remote Configurations

```bash
synclet config pull
```

Downloads and syncs your configuration bundles from Synclet.

## Working with Plans

Plans define which files and directories to sync. Execute a plan to sync your configurations:

```bash
synclet plan --passphrase xxxx
```

or with dropbox

```bash
synclet plan --passphrase xxxx --backend dropbox
```

This command will execute the plan defined in your configuration bundle, syncing the specified files and directories. The passphrase is required to decrypt your encrypted configuration files.

## Sync Command

Manually trigger a sync of your configurations:

```bash
synclet sync --passphrase xxxx
```

or with dropbox

```bash
synclet sync --passphrase xxxx --backend dropbox
```

This will upload any local changes and download any remote changes to your configuration files. The passphrase is required to encrypt and decrypt your files.

## Common Workflow

A typical workflow looks like this:

1. **Login:**

   ```bash
   synclet auth login
   ```

2. **Initialize or pull configuration:**

   ```bash
   synclet config init
   ```

   or

   ```bash
   synclet config pull
   ```

3. **Execute plan:**

   ```bash
   synclet plan --passphrase xxxx
   ```

4. **Sync changes:**
   ```bash
   synclet sync --passphrase xxxx
   ```
