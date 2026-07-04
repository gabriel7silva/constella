---
name: vagrant
description: Vagrant is HashiCorp's tool for building and managing reproducible virtual machine development environments via a Vagrantfile; consult when configuring boxes, providers (VirtualBox/libvirt/Hyper-V), provisioners, synced folders, networking, or running vagrant up/ssh/destroy.
domain: stack
category: infra
tags: [vagrant, hashicorp, virtualization, devops, infrastructure, vm, dev-environment]
official_sources:
  - https://developer.hashicorp.com/vagrant/docs
  - https://github.com/hashicorp/vagrant
  - https://developer.hashicorp.com/vagrant/install
verified: 2026-06-17
---

# Vagrant

## Overview
Vagrant is HashiCorp's command-line tool for building and managing portable, reproducible virtual machine environments. A single `Vagrantfile` describes the box, provider, networking, and provisioning so any team member can run `vagrant up` to get an identical dev environment. Read this when configuring local VMs, defining provisioners, or scripting the VM lifecycle.

## Official sources
- Docs: https://developer.hashicorp.com/vagrant/docs
- Repo: https://github.com/hashicorp/vagrant
- Install: https://developer.hashicorp.com/vagrant/install

## Install / setup
```bash
# macOS via Homebrew
brew tap hashicorp/tap
brew install hashicorp/tap/hashicorp-vagrant
```
Source: https://developer.hashicorp.com/vagrant/install

## Core concepts
- **Vagrantfile** — Ruby-based config (one per project) describing how to build and provision the VM.
- **Box** — packaged base image (e.g. `hashicorp/bionic64`) used as the VM starting point.
- **Provider** — virtualization backend that runs the VM (VirtualBox, libvirt, Hyper-V, VMware).
- **Provisioner** — installs/configures software on `up` (shell, Ansible, Chef, Puppet, Docker).
- **Synced folder** — host directory mounted into the guest (defaults to project dir at `/vagrant`).
- **Box lifecycle** — `vagrant up` creates/boots, `ssh` connects, `halt` stops, `destroy` removes.
- **Networking** — forwarded ports, private (host-only), or public (bridged) networks.
- **Multi-machine** — define several VMs in one Vagrantfile via `config.vm.define`.

## Best practices
- Commit the `Vagrantfile` to version control so environments are reproducible (https://developer.hashicorp.com/vagrant/docs/vagrantfile).
- Use provisioners to bake setup into the box rather than manual SSH steps (https://developer.hashicorp.com/vagrant/docs/provisioning).
- Pin box versions to avoid unexpected base-image changes (https://developer.hashicorp.com/vagrant/docs/boxes/versioning).
- Source boxes from the official Vagrant Cloud catalog (https://portal.cloud.hashicorp.com/vagrant/discover).
- Keep provider-specific tweaks in a `config.vm.provider` block for portability (https://developer.hashicorp.com/vagrant/docs/providers).

## Common pitfalls
- `vagrant` not on PATH after install on Windows → log out and back in so PATH refreshes.
- Slow or failing synced folders on VirtualBox → enable NFS or rsync for large codebases.
- Stale VM state after Vagrantfile edits → run `vagrant reload --provision` to re-apply.

## Examples
```ruby
Vagrant.configure("2") do |config|
  config.vm.box = "hashicorp/bionic64"
  config.vm.network "forwarded_port", guest: 80, host: 8080
  config.vm.provision "shell", inline: "apt-get update && apt-get install -y nginx"
end
```

## Further reading
- https://developer.hashicorp.com/vagrant/docs/vagrantfile — Vagrantfile reference
- https://developer.hashicorp.com/vagrant/docs/provisioning — provisioners guide
- https://portal.cloud.hashicorp.com/vagrant/discover — public box catalog

## Related skills
- ../ansible — provision Vagrant VMs with playbooks
- ../terraform — provision real infrastructure beyond local VMs
