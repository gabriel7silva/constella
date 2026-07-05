---
name: ansible
description: Ansible is Red Hat's agentless IT automation tool that configures systems and orchestrates deployments via YAML playbooks over SSH; consult when writing playbooks, roles, inventories, tasks, handlers, or using modules and collections to provision, configure, or deploy across many hosts.
domain: stack
category: infra
tags: [ansible, automation, configuration-management, devops, infrastructure, yaml, playbook]
official_sources:
  - https://docs.ansible.com/
  - https://github.com/ansible/ansible
  - https://docs.ansible.com/projects/ansible/latest/installation_guide/intro_installation.html
verified: 2026-06-17
---

# Ansible

## Overview
Ansible is an open-source, agentless IT automation engine for configuration management, application deployment, and orchestration. It connects to managed nodes over SSH (or WinRM) and applies idempotent tasks described declaratively in YAML playbooks, requiring no software installed on the targets. Read this when authoring playbooks/roles, defining inventories, or automating multi-host configuration.

## Official sources
- Docs: https://docs.ansible.com/
- Repo: https://github.com/ansible/ansible
- Install: https://docs.ansible.com/projects/ansible/latest/installation_guide/intro_installation.html

## Install / setup
```bash
python3 -m pip install --user ansible
```
Source: https://docs.ansible.com/projects/ansible/latest/installation_guide/intro_installation.html

## Core concepts
- **Control node** — machine where Ansible runs; managed nodes need only SSH and Python.
- **Inventory** — list of managed hosts, grouped, in INI or YAML (`-i inventory`).
- **Playbook** — ordered YAML file mapping plays (host groups) to tasks.
- **Task** — a single call to a module (e.g. `ansible.builtin.copy`); strives for idempotency.
- **Module** — reusable unit of work executed on a host; ships in collections.
- **Role** — packaged, reusable structure of tasks, handlers, vars, and templates.
- **Handler** — task triggered by `notify`, run once at the end (e.g. restart a service).
- **Collection** — distributable bundle of modules, roles, and plugins (via Ansible Galaxy).

## Best practices
- Write idempotent tasks so repeated runs converge without side effects (https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html).
- Organize reusable automation into roles with a standard directory layout (https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html).
- Encrypt secrets at rest with Ansible Vault instead of plaintext vars (https://docs.ansible.com/ansible/latest/vault_guide/index.html).
- Reference modules by fully qualified collection name, e.g. `ansible.builtin.copy` (https://docs.ansible.com/ansible/latest/collections/index.html).
- Install Galaxy dependencies via `requirements.yml` for reproducibility (https://docs.ansible.com/ansible/latest/galaxy/user_guide.html).

## Common pitfalls
- Using `command`/`shell` for things a module handles → breaks idempotency; prefer the dedicated module.
- Hardcoding passwords/keys in playbooks → store them in Ansible Vault.
- Host unreachable due to SSH/key issues → verify with `ansible all -m ping -i inventory`.

## Examples
```yaml
- name: Ensure nginx is installed and running
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present
    - name: Start nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

## Further reading
- https://docs.ansible.com/ansible/latest/playbook_guide/index.html — playbook authoring guide
- https://galaxy.ansible.com/ — Ansible Galaxy collections/roles hub
- https://docs.ansible.com/ansible/latest/collections/ansible/builtin/index.html — builtin module index

## Related skills
- ../terraform — provision infrastructure that Ansible then configures
- ../vagrant — spin up local VMs to test playbooks against
