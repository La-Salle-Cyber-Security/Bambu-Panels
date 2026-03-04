# 🖨️ Bambu-Panels

Utilities and setup instructions for running **go2rtc** with Bambu printers (X1-Plus firmware).

---

## Overview

This project uses **go2rtc** to expose and manage camera streams from a Bambu printer.

The version referenced here was built for:

- **Mac ARM64**

You will need to download and install your own compatible version from the official repository.

---

## Install go2rtc

Download the appropriate build from the official GitHub repository:

https://github.com/AlexxIT/go2rtc

After downloading, extract and place the binary somewhere convenient on your system.

---

## Preparing SSH on the Printer

When using **X1-Plus firmware**, the printer may not already have an SSH key directory.  
Create it manually with the following commands.

### Create the SSH directory

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
