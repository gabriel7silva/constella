---
name: selenium
description: Selenium WebDriver is the W3C-standard browser-automation API for controlling real browsers across Java, Python, C#, Ruby, and JavaScript; consult when writing cross-browser UI tests, locating elements, handling waits/frames/windows, or running tests with Selenium Grid and WebDriver drivers.
domain: stack
category: testing
tags: [selenium, webdriver, browser-automation, e2e, cross-browser, grid, ui-testing]
official_sources:
  - https://www.selenium.dev/documentation/webdriver/getting_started/
  - https://github.com/SeleniumHQ/selenium
  - https://www.selenium.dev/documentation/webdriver/getting_started/install_library/
verified: 2026-06-17
---

# Selenium

## Overview
Selenium WebDriver is a language-neutral API and W3C protocol for driving real browsers (Chrome, Firefox, Edge, Safari) programmatically. It has official bindings for Java, Python, C#, Ruby, JavaScript, and Kotlin, and scales out via Selenium Grid. Read this when automating cross-browser UI tests, locating and interacting with elements, handling explicit waits, frames, and alerts, or distributing runs across machines.

## Official sources
- Docs: https://www.selenium.dev/documentation/webdriver/getting_started/
- Repo: https://github.com/SeleniumHQ/selenium
- Install: https://www.selenium.dev/documentation/webdriver/getting_started/install_library/

## Install / setup
```bash
pip install selenium
```
Source: https://www.selenium.dev/documentation/webdriver/getting_started/install_library/ (Java uses the Maven `org.seleniumhq.selenium:selenium-java` dependency; drivers are auto-managed by Selenium Manager).

## Core concepts
- **WebDriver** — the session object that launches and commands a browser per the W3C protocol.
- **Locators** — `By.id`, `By.cssSelector`, `By.xpath`, etc. find elements on the page.
- **WebElement** — handle for an element you can `click()`, `send_keys()`, or read text from.
- **Explicit waits** — `WebDriverWait` + expected conditions poll until an element is ready.
- **Selenium Manager** — built-in tool that downloads matching browser drivers automatically.
- **Selenium Grid** — runs tests remotely and in parallel across browsers/OSes via a hub/nodes.
- **Frames & windows** — `switch_to.frame()` / `switch_to.window()` change the driver's focus.
- **Actions API** — chains advanced keyboard/mouse interactions (hover, drag, key combos).

## Best practices
- Use explicit waits over `sleep`; avoid deprecated implicit+explicit mixing (https://www.selenium.dev/documentation/webdriver/waits/).
- Prefer stable locators (id, name, data attributes) over brittle XPath (https://www.selenium.dev/documentation/webdriver/elements/locators/).
- Always `driver.quit()` to release the browser and driver process (https://www.selenium.dev/documentation/webdriver/drivers/).
- Apply the Page Object pattern to isolate selectors from test logic (https://www.selenium.dev/documentation/test_practices/encouraged/page_object_models/).

## Common pitfalls
- `NoSuchElementException` on dynamic pages → wait with `WebDriverWait` + expected conditions.
- Mixing implicit and explicit waits causes unpredictable timeouts → use explicit waits only.
- Stale element after DOM re-render → re-find the element instead of reusing the handle.

## Examples
```python
from selenium import webdriver
from selenium.webdriver.common.by import By

driver = webdriver.Chrome()
driver.get("https://www.selenium.dev/")
assert "Selenium" in driver.title
driver.find_element(By.CSS_SELECTOR, "a.navbar-brand")
driver.quit()
```

## Further reading
- https://www.selenium.dev/documentation/webdriver/waits/ — waiting strategies
- https://www.selenium.dev/documentation/grid/ — distributing tests with Grid

## Related skills
- ../playwright — modern auto-waiting cross-browser alternative
- ../cypress — in-browser JavaScript E2E framework
- ../puppeteer — Chrome/Firefox DevTools-Protocol automation
