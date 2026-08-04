const MODEL = "御 Mavic Pro";
const SN = "08QUE5A00100MA";
const TRADE_IN_PLAN = "DJI Mavic 4 Pro 512GB 创作者套装（DJI RC Pro 2，增强图传）翻新机";
const CONTACT_NAME = "李怡德";
const CONTACT_PROVINCE = "广东省";
const CONTACT_CITY = "中山市";
const CONTACT_DISTRICT = "五桂山街道";
const CONTACT_ADDRESS = "广东省中山市五桂山街道五桂山镇桂南村雅居乐御龙山星曜2期10栋205";

const runButton = document.getElementById("run");
const statusEl = document.getElementById("status");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function setStatus(text) {
  statusEl.textContent = text;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("无法读取当前标签页。");
  }

  if (!tab.url?.startsWith("https://support.dji.com/")) {
    throw new Error("请先打开 DJI 支持页面。");
  }

  return tab;
}

async function executeInPage(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func,
    args
  });

  return results?.[0]?.result;
}

async function attachDebugger(tabId) {
  await chrome.debugger.attach({ tabId }, "1.3");
}

async function detachDebugger(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // Ignore detach failures.
  }
}

async function dispatchKey(tabId, type, key, code, keyCode, text) {
  const params = {
    type,
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode
  };

  if (text !== undefined) {
    params.text = text;
  }

  await chrome.debugger.sendCommand(
    { tabId },
    "Input.dispatchKeyEvent",
    params
  );
}

async function pressEnter(tabId) {
  await dispatchKey(tabId, "keyDown", "Enter", "Enter", 13, "\r");
  await sleep(50);
  await dispatchKey(tabId, "keyUp", "Enter", "Enter", 13);
}

async function pressShortcutSelectAll(tabId) {
  await dispatchKey(tabId, "keyDown", "Control", "ControlLeft", 17);
  await dispatchKey(tabId, "keyDown", "a", "KeyA", 65);
  await dispatchKey(tabId, "keyUp", "a", "KeyA", 65);
  await dispatchKey(tabId, "keyUp", "Control", "ControlLeft", 17);
}

async function pressBackspace(tabId) {
  await dispatchKey(tabId, "keyDown", "Backspace", "Backspace", 8);
  await dispatchKey(tabId, "keyUp", "Backspace", "Backspace", 8);
}

async function insertText(tabId, text) {
  await chrome.debugger.sendCommand(
    { tabId },
    "Input.insertText",
    { text }
  );
}

async function focusModelCombobox(tabId) {
  return executeInPage(tabId, () => {
    const boxes = Array.from(
      document.querySelectorAll('button[role="combobox"]')
    ).filter(element => {
      return !element.disabled && element.getClientRects().length > 0;
    });

    const target = boxes[0];
    if (!target) return false;

    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });

    return document.activeElement === target;
  });
}

async function focusModelOption(tabId, modelText, timeoutMs = 7000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const focused = await executeInPage(tabId, targetText => {
      const normalize = value =>
        String(value || "").replace(/\s+/g, " ").trim();

      const options = Array.from(
        document.querySelectorAll('[role="option"]')
      ).filter(element => element.getClientRects().length > 0);

      const target = options.find(element => {
        return normalize(element.textContent) === normalize(targetText);
      });

      if (!target) return false;

      target.scrollIntoView({ block: "nearest" });
      target.focus({ preventScroll: true });

      return document.activeElement === target;
    }, [modelText]);

    if (focused) return true;
    await sleep(120);
  }

  return false;
}

async function isModelSelected(tabId, modelText) {
  return executeInPage(tabId, targetText => {
    const boxes = Array.from(
      document.querySelectorAll('button[role="combobox"]')
    ).filter(element => element.getClientRects().length > 0);

    const box = boxes[0];
    if (!box) return false;

    const text = String(box.innerText || box.textContent || "");
    return text.includes(targetText);
  }, [modelText]);
}

async function focusSnInput(tabId, timeoutMs = 7000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const focused = await executeInPage(tabId, () => {
      const inputs = Array.from(
        document.querySelectorAll(
          'input:not([disabled]):not([aria-hidden="true"])'
        )
      ).filter(element => {
        if (!element.getClientRects().length) return false;

        const placeholder = String(element.placeholder || "");
        const ariaLabel = String(element.getAttribute("aria-label") || "");
        const name = String(element.name || "");

        return /SN/i.test(placeholder) ||
               /SN/i.test(ariaLabel) ||
               /serial/i.test(name);
      });

      const input = inputs[0];
      if (!input) return false;

      input.scrollIntoView({ block: "center" });
      input.focus({ preventScroll: true });

      if (typeof input.select === "function") {
        input.select();
      }

      return document.activeElement === input;
    });

    if (focused) return true;
    await sleep(120);
  }

  return false;
}

async function readSnValue(tabId) {
  return executeInPage(tabId, () => {
    const input = Array.from(
      document.querySelectorAll(
        'input:not([disabled]):not([aria-hidden="true"])'
      )
    ).find(element => {
      if (!element.getClientRects().length) return false;

      const placeholder = String(element.placeholder || "");
      const ariaLabel = String(element.getAttribute("aria-label") || "");
      const name = String(element.name || "");

      return /SN/i.test(placeholder) ||
             /SN/i.test(ariaLabel) ||
             /serial/i.test(name);
    });

    return input?.value || "";
  });
}

async function clickNextButton(tabId, timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const clicked = await executeInPage(tabId, () => {
      const normalize = value =>
        String(value || "").replace(/\s+/g, " ").trim();

      const candidates = Array.from(
        document.querySelectorAll('button, [role="button"]')
      ).filter(element => {
        if (!element.getClientRects().length) return false;
        if (element.disabled) return false;
        if (element.getAttribute("aria-disabled") === "true") return false;

        const text = normalize(
          element.innerText ||
          element.textContent ||
          element.getAttribute("aria-label")
        );

        return text === "下一步";
      });

      const button = candidates[0];
      if (!button) return false;

      button.scrollIntoView({ block: "center" });
      button.click();
      return true;
    });

    if (clicked) return true;
    await sleep(150);
  }

  return false;
}


async function focusTradeInCombobox(tabId, timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const focused = await executeInPage(tabId, () => {
      const boxes = Array.from(
        document.querySelectorAll('button[role="combobox"]')
      ).filter(element => {
        return !element.disabled &&
               element.getClientRects().length > 0 &&
               element.getAttribute("aria-expanded") !== "true";
      });

      // 下一页只有换购方案选择框；若存在多个，优先选择最后出现的可见框。
      const target = boxes[boxes.length - 1];
      if (!target) return false;

      target.scrollIntoView({ block: "center" });
      target.focus({ preventScroll: true });

      return document.activeElement === target;
    });

    if (focused) return true;
    await sleep(120);
  }

  return false;
}

async function focusTradeInOption(tabId, planText, timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const focused = await executeInPage(tabId, targetText => {
      const normalize = value =>
        String(value || "")
          .replace(/\s+/g, " ")
          .replace(/[（]/g, "(")
          .replace(/[）]/g, ")")
          .replace(/[，]/g, ",")
          .trim();

      const expected = normalize(targetText);

      const options = Array.from(
        document.querySelectorAll('[role="option"]')
      ).filter(element => element.getClientRects().length > 0);

      const target = options.find(element => {
        const actual = normalize(element.textContent);

        // 严格匹配，不再只按型号关键词匹配
        return actual === expected;
      });

      if (!target) return false;

      target.scrollIntoView({ block: "nearest" });
      target.focus({ preventScroll: true });

      return document.activeElement === target;
    }, [planText]);

    if (focused) return true;

    await sleep(120);
  }

  return false;
}

async function waitForTradeInPlanSelected(
  tabId,
  planText,
  timeoutMs = 6000
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const selected = await executeInPage(tabId, expectedText => {
      const normalize = value =>
        String(value || "")
          .replace(/\s+/g, " ")
          .replace(/[（]/g, "(")
          .replace(/[）]/g, ")")
          .replace(/[，]/g, ",")
          .trim();

      const expected = normalize(expectedText);

      const boxes = Array.from(
        document.querySelectorAll('button[role="combobox"]')
      ).filter(element => element.getClientRects().length > 0);

      return boxes.some(box => {
        const actual = normalize(
          box.innerText || box.textContent || ""
        );

        // 必须与配置完全一致
        return actual === expected;
      });
    }, [planText]);

    if (selected) return true;

    await sleep(150);
  }

  return false;
}

async function isTradeInPlanSelected(tabId, planText) {
  // 整个函数删除
}


async function waitForContactPage(tabId, timeoutMs = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const ready = await executeInPage(tabId, () => {
      const selects = Array.from(document.querySelectorAll("select"));
      const nameInput = Array.from(document.querySelectorAll("input"))
        .find(input => String(input.placeholder || "").includes("请输入姓名"));
      const addressInput = Array.from(document.querySelectorAll("input"))
        .find(input => String(input.placeholder || "").includes("详细地址"));

      return selects.length >= 3 && Boolean(nameInput) && Boolean(addressInput);
    });

    if (ready) return true;
    await sleep(150);
  }

  return false;
}

async function selectNativeOption(tabId, selectIndex, optionText, timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const selected = await executeInPage(tabId, (index, targetText) => {
      const selects = Array.from(document.querySelectorAll("select"))
        .filter(element => element.getClientRects().length > 0);

      const select = selects[index];
      if (!select || select.disabled) return false;

      const option = Array.from(select.options).find(item => {
        return String(item.textContent || "").trim() === targetText ||
               String(item.value || "").trim() === targetText;
      });

      if (!option) return false;

      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      );

      if (descriptor?.set) {
        descriptor.set.call(select, option.value);
      } else {
        select.value = option.value;
      }

      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));

      return select.value === option.value;
    }, [selectIndex, optionText]);

    if (selected) return true;
    await sleep(150);
  }

  return false;
}

async function fillContactInput(tabId, placeholderKeyword, value, timeoutMs = 8000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const filled = await executeInPage(tabId, (keyword, targetValue) => {
      const input = Array.from(document.querySelectorAll("input"))
        .find(element => {
          return element.getClientRects().length > 0 &&
                 !element.disabled &&
                 String(element.placeholder || "").includes(keyword);
        });

      if (!input) return false;

      input.scrollIntoView({ block: "center" });
      input.focus({ preventScroll: true });

      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      );

      if (descriptor?.set) {
        descriptor.set.call(input, targetValue);
      } else {
        input.value = targetValue;
      }

      if (input._valueTracker) {
        input._valueTracker.setValue("");
      }

      input.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true,
        inputType: "insertText",
        data: targetValue
      }));
      input.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: targetValue
      }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));

      return input.value === targetValue;
    }, [placeholderKeyword, value]);

    if (filled) return true;
    await sleep(150);
  }

  return false;
}

async function verifyContactInfo(tabId) {
  return executeInPage(tabId, (name, province, city, district, address) => {
    const selects = Array.from(document.querySelectorAll("select"))
      .filter(element => element.getClientRects().length > 0);

    const nameInput = Array.from(document.querySelectorAll("input"))
      .find(input => String(input.placeholder || "").includes("请输入姓名"));

    const addressInput = Array.from(document.querySelectorAll("input"))
      .find(input => String(input.placeholder || "").includes("详细地址"));

    return selects[0]?.value === province &&
           selects[1]?.value === city &&
           selects[2]?.value === district &&
           nameInput?.value === name &&
           addressInput?.value === address;
  }, [CONTACT_NAME, CONTACT_PROVINCE, CONTACT_CITY, CONTACT_DISTRICT, CONTACT_ADDRESS]);
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  let tabId;

  try {
    const tab = await getActiveTab();
    tabId = tab.id;

    await attachDebugger(tabId);

    setStatus("正在打开机型选择框…");
    if (!(await focusModelCombobox(tabId))) {
      throw new Error("未找到机型选择框。");
    }

    await pressEnter(tabId);

    setStatus("正在选择“御 Mavic Pro”…");
    if (!(await focusModelOption(tabId, MODEL))) {
      throw new Error("未找到“御 Mavic Pro”选项。");
    }

    await pressEnter(tabId);
    await sleep(500);

    if (!(await isModelSelected(tabId, MODEL))) {
      throw new Error("机型未成功选中。");
    }

    setStatus("机型已选中，正在输入 SN…");
    if (!(await focusSnInput(tabId))) {
      throw new Error("未找到 SN 输入框。");
    }

    await pressShortcutSelectAll(tabId);
    await pressBackspace(tabId);
    await insertText(tabId, SN);
    await sleep(300);

    const actualSn = await readSnValue(tabId);
    if (actualSn !== SN) {
      throw new Error(`SN 输入失败，当前值：${actualSn || "空"}`);
    }

    await pressEnter(tabId);

    setStatus("SN 已输入，正在点击“下一步”…");
    if (!(await clickNextButton(tabId))) {
      throw new Error("未找到可用的“下一步”按钮。");
    }

    setStatus("已点击下一步，正在等待换购方案页面…");
    await sleep(500);

    setStatus("正在打开换购方案选择框…");
    if (!(await focusTradeInCombobox(tabId))) {
      throw new Error("未找到换购方案选择框。");
    }

    await pressEnter(tabId);

    setStatus("正在选择指定换购方案…");
    if (!(await focusTradeInOption(tabId, TRADE_IN_PLAN))) {
      throw new Error("未找到指定换购方案。");
    }

    await pressEnter(tabId);

    if (!(await waitForTradeInPlanSelected(
      tabId,
      TRADE_IN_PLAN
    ))) {
      throw new Error("换购方案未成功选中，或选中了非目标版本。");
    }

    setStatus("换购方案已选中，正在点击下一步…");
    if (!(await clickNextButton(tabId))) {
      throw new Error("换购方案页面未找到可用的“下一步”按钮。");
    }

    setStatus("正在等待联系信息页面…");
    if (!(await waitForContactPage(tabId))) {
      throw new Error("联系信息页面加载超时。");
    }

    setStatus("正在选择广东省…");
    if (!(await selectNativeOption(tabId, 0, CONTACT_PROVINCE))) {
      throw new Error("未能选择广东省。");
    }
    await sleep(250);

    setStatus("正在选择中山市…");
    if (!(await selectNativeOption(tabId, 1, CONTACT_CITY))) {
      throw new Error("未能选择中山市。");
    }
    await sleep(250);

    setStatus("正在选择五桂山街道…");
    if (!(await selectNativeOption(tabId, 2, CONTACT_DISTRICT))) {
      throw new Error("未能选择五桂山街道。");
    }

    setStatus("正在填写姓名…");
    if (!(await fillContactInput(tabId, "请输入姓名", CONTACT_NAME))) {
      throw new Error("姓名填写失败。");
    }

    setStatus("正在填写详细地址…");
    if (!(await fillContactInput(tabId, "详细地址", CONTACT_ADDRESS))) {
      throw new Error("详细地址填写失败。");
    }

    await sleep(300);

    if (!(await verifyContactInfo(tabId))) {
      throw new Error("联系信息校验失败。");
    }

    setStatus("联系信息已填写，正在点击下一步…");
    if (!(await clickNextButton(tabId))) {
      throw new Error("联系信息页面未找到可用的“下一步”按钮。");
    }

    setStatus("完成：已填写全部信息并进入下一步。");
  } catch (error) {
    setStatus(`失败：${error.message}`);
  } finally {
    if (tabId) {
      await detachDebugger(tabId);
    }

    runButton.disabled = false;
  }
});