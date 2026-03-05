# 🖨️ Bambu-Panels

Utilities and setup scripts for running **go2rtc camera streaming** and related tools with **Bambu Lab printers running X1-Plus firmware**.

This project provides a simple way to install and run supporting tools for interacting with your printer, including packaged installers and automatic release builds.

---

# Overview

Bambu-Panels helps set up and run **go2rtc** and related scripts so that camera streams and integrations can work easily with Bambu printers.

The repository includes:

* Setup scripts
* Web components
* Automated installers
* Cross-platform release builds
* Documentation for configuring SSH and services

---

# Requirements

Before using this project you should have:

* A **Bambu Lab printer**
* **X1-Plus firmware installed**
* Network access to the printer
* SSH access enabled

Recommended knowledge:

* Basic terminal usage
* Basic networking

---

## Repo map

- docs/REPO_TREE.md
- docs/repo-diagram.mmd

---

# What This Project Provides

Each release automatically builds several downloadable assets.

### macOS installers

| Installer                                | Description                      |
| ---------------------------------------- | -------------------------------- |
| `bambu-panels-<version>-macos-arm64.pkg` | Installer for Apple Silicon Macs |
| `bambu-panels-<version>-macos-amd64.pkg` | Installer for Intel Macs         |

These installers include:

* Bambu-Panels files
* The correct **go2rtc binary**
* Required folder structure

Installation location:

```
/Applications/Bambu-Panels
```

---

### Linux bundle

| File                                        | Description           |
| ------------------------------------------- | --------------------- |
| `bambu-panels-<version>-linux-amd64.tar.gz` | Portable Linux bundle |

This archive includes:

* Scripts
* Web files
* go2rtc binary

Extract and run locally.

---

### Source packages

These are automatically generated:

```
bambu-panels-<version>-source.tar.gz
bambu-panels-<version>-source.zip
```

They contain the raw repository contents.

---

# Installing

## macOS

1. Download the correct `.pkg` installer from the **Releases** page.
2. Open the installer.
3. Follow the installation prompts.

After installation you will find the files in:

```
/Applications/Bambu-Panels
```

---

## Linux

Download the Linux archive and extract it:

```bash
tar -xzf bambu-panels-<version>-linux-amd64.tar.gz
cd bambu-panels
```

Then run your startup script:

```bash
./start.sh
```

---

# Preparing the Printer (SSH Setup)

When using **X1-Plus**, the SSH directory may not exist yet.

Create it manually on the printer:

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
```

This ensures SSH keys can be stored correctly.

---

# go2rtc

This project uses **go2rtc** to access and stream the printer camera.

Repository:

https://github.com/AlexxIT/go2rtc

During release builds the correct binary for each platform is automatically downloaded and bundled into the installer.

You do **not** need to manually install go2rtc when using the packaged installers.

---

# Project Structure

```
Bambu-Panels
│
├── scripts/
│   └── fetch_go2rtc.py
│
├── public/
│
├── start.sh
│
├── README.md
│
└── .github/workflows/
    └── release.yml
```

---

# Building Releases

Releases are automatically created by GitHub Actions.

Trigger a release by creating a tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The workflow will:

1. Build installers
2. Download the correct go2rtc binaries
3. Package the project
4. Upload release assets
5. Generate automatic release notes

---

# Development

Clone the repository:

```bash
git clone https://github.com/<your-username>/Bambu-Panels.git
cd Bambu-Panels
```

Modify scripts or web files as needed.

Push changes normally.

Create a tag to build a new release.

---

# Configuration

Create a configuration file from the template:

cp .env.example .env

Then edit it with your printer's information.

---

# Contributing

Contributions are welcome.

Helpful contributions include:

* documentation improvements
* bug fixes
* platform support
* UI improvements

---

# License

Add your preferred license here.
