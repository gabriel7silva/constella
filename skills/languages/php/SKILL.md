---
name: php
description: General-purpose server-side scripting language for the web; consult for PHP syntax, OOP, Composer, and install/setup.
domain: language
category: language
tags: [php, server-side, web, scripting, backend]
official_sources:
  - https://www.php.net/docs.php
  - https://github.com/php/php-src
verified: 2026-06-16
---

# PHP

## Overview
PHP is a popular general-purpose scripting language especially suited to web development; it powers a large share of the web from blogs to major sites. Code is embedded in or generated alongside HTML and executed server-side. Read this when building web backends in PHP, working with Composer packages, or setting up a PHP runtime.

## Official sources
- Docs: https://www.php.net/docs.php
- Repo: https://github.com/php/php-src
- Install / download: https://www.php.net/downloads

## Install / setup
The official downloads page shows per-OS instructions. For Debian/Ubuntu it lists, verbatim:

```bash
# Update the package lists.
sudo apt update

# Install PHP.
sudo apt install -y php
```

Source: https://www.php.net/downloads (current stable versions listed there include 8.5, 8.4, 8.3, 8.2)

## Core concepts
- Request lifecycle — PHP scripts typically run per HTTP request and exit; state does not persist across requests unless stored (session, DB, cache).
- Types and weak/strict typing — PHP is dynamically typed but supports type declarations and `declare(strict_types=1)` for strict scalar typing.
- Classes, interfaces, traits, and enumerations — full OOP model; traits share method implementations across classes.
- Namespaces — organize and disambiguate classes/functions to avoid collisions.
- Superglobals and predefined variables — `$_GET`, `$_POST`, `$_SESSION`, `$_SERVER` expose request and environment data.
- Composer — the de facto dependency manager and PSR-4 autoloader for PHP libraries.
- Errors, exceptions, generators, fibers, and attributes are part of the modern language reference.

## Best practices
- Enable `declare(strict_types=1)` and use type declarations to catch type errors early (see php.net Language Reference: Types).
- Follow the Security section of the docs: validate and escape all user-submitted data, use prepared statements for databases.
- Manage dependencies and autoloading with Composer rather than manual `require` chains.
- Keep PHP on a supported version (php.net lists active versions) and apply security releases promptly.

## Common pitfalls
- Concatenating user input into SQL → use parameterized/prepared statements (PDO or mysqli) to prevent injection.
- Echoing unescaped user data into HTML → escape output (`htmlspecialchars`) to prevent XSS, per the docs' security guidance.
- Relying on loose comparison (`==`) where type juggling surprises (e.g. `"0" == false`) → use strict comparison (`===`).

## Examples
```php
<?php
declare(strict_types=1);

function greet(string $name): string {
    return "Hello, " . htmlspecialchars($name);
}

echo greet($_GET['name'] ?? 'world');
```

## Further reading
- Language reference: https://www.php.net/docs.php
- Security considerations: https://www.php.net/docs.php (Security section)

## Related skills
- ../ruby — dynamic scripting language comparison
- ../../stacks — PHP web frameworks (Laravel, Symfony) consume this language
