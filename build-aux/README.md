# Flatpak Build

## Prerequisites
```bash
flatpak install flathub org.freedesktop.Sdk//24.08 org.freedesktop.Platform//24.08
flatpak install flathub org.freedesktop.Sdk.Extension.rust-stable
```

## Build
```bash
cd build-aux
flatpak-builder --force-clean build-dir smemaster.flatpak.yml
flatpak build-export repo build-dir
flatpak install --user -y smemaster.flatpakref
```

## Run
```bash
flatpak run com.smemaster.app
```
