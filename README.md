# ConfigMesh CLI

ConfigMesh comes with a companion CLI tool that you can deploy to your server or run on your macOS machine. The CLI provides powerful automation capabilities for syncing your configuration files across your infrastructure.

Get the ConfigMesh macOS app at https://configmesh.app

## Installation

Install the ConfigMesh CLI globally via npm:

```bash
npm install -g configmesh
```

This downloads a prebuilt binary at install time.

## Authentication

Before using ConfigMesh, you need to authenticate:

```bash
configmesh auth login
```

This command will open your browser to complete the login process.

## Configuration

Set up a new configuration or pull existing configurations from remote:

### Initialize New Configuration

```bash
configmesh config init
```

Creates a new configuration bundle in the current directory.

### Pull Remote Configurations

```bash
configmesh config pull
```

Downloads and syncs your configuration bundles from ConfigMesh.

## Working with Plans

Plans define which files and directories to sync. Execute a plan to sync your configurations:

```bash
configmesh plan --passphrase xxxx
```

This command will execute the plan defined in your configuration bundle, syncing the specified files and directories. The passphrase is required to decrypt your encrypted configuration files.

## Sync Command

Manually trigger a sync of your configurations:

```bash
configmesh sync --passphrase xxxx
```

This will upload any local changes and download any remote changes to your configuration files. The passphrase is required to encrypt and decrypt your files.

## Common Workflow

A typical workflow looks like this:

1. **Login:**

   ```bash
   configmesh auth login
   ```

2. **Initialize or pull configuration:**

   ```bash
   configmesh config init
   ```

   or

   ```bash
   configmesh config pull
   ```

3. **Execute plan:**

   ```bash
   configmesh plan --passphrase xxxx
   ```

4. **Sync changes:**
   ```bash
   configmesh sync --passphrase xxxx
   ```
