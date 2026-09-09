(() => {
  'use strict';

  const STORAGE_CURRENT = 'monthlySalaryDashboard.current.v1';
  const STORAGE_RECORDS = 'monthlySalaryDashboard.records.v1';
  const APP_VERSION = 3;

  const numericFields = new Set([
    'monthlySalary', 'standardDays', 'hoursPerDay', 'normalDays',
    'normalOtMinutes', 'saturdayDays', 'saturdayOtMinutes',
    'sundayDays', 'sundayOtMinutes', 'specialSkill', 'housing',
    'language', 'gasoline', 'food', 'diligence', 'otherIncome',
    'medical', 'attendanceFull', 'attendancePartial', 'vacationDays',
    'unpaidLeaveDays', 'lateMinutes', 'normalOtRate', 'saturdayDayRate',
    'saturdayOtRate', 'sundayDayRate', 'sundayOtRate', 'vacationRate',
    'lateRate', 'pvdRate', 'pvdManual', 'socialRate', 'socialMaxBase',
    'socialManual'
  ]);

  const booleanFields = new Set(['pvdEnabled', 'socialEnabled']);

  const createDefaultDeductionItems = () => ([
    { id: 'deduction-tisco', name: 'เงินกู้ TISCO', amount: 0 },
    { id: 'deduction-kys', name: 'K.Y.S.', amount: 0 },
    { id: 'deduction-tax', name: 'ภาษี', amount: 0 },
    { id: 'deduction-other', name: 'รายการหักอื่น', amount: 0 }
  ]);

  const moneyFormatter = new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const numberFormatter = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const integerFormatter = new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: 0
  });

  const compactFormatter = new Intl.NumberFormat('th-TH', {
    notation: 'compact',
    maximumFractionDigits: 1
  });

  const currentMonth = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const createBaseConfiguration = () => ({
    periodMonth: currentMonth(),

    monthlySalary: 0,
    standardDays: 23,
    hoursPerDay: 8,
    normalDays: 23,
    normalOtMinutes: 0,
    saturdayDays: 0,
    saturdayOtMinutes: 0,
    sundayDays: 0,
    sundayOtMinutes: 0,

    specialSkill: 0,
    housing: 0,
    language: 0,
    gasoline: 0,
    food: 0,
    diligence: 0,
    otherIncome: 0,
    medical: 0,
    attendanceFull: 0,
    attendancePartial: 0,
    vacationDays: 0,

    deductionItems: createDefaultDeductionItems(),
    unpaidLeaveDays: 0,
    lateMinutes: 0,

    normalOtRate: 1.5,
    saturdayDayRate: 1.5,
    saturdayOtRate: 3,
    sundayDayRate: 2,
    sundayOtRate: 3,
    vacationRate: 1,
    lateRate: 1,

    pvdEnabled: true,
    pvdRate: 7,
    pvdManual: 0,
    socialEnabled: true,
    socialRate: 5,
    socialMaxBase: 17500,
    socialManual: 0
  });

  const createSampleState = () => ({
    ...createBaseConfiguration(),
    monthlySalary: 19193,
    normalOtMinutes: 1152,
    specialSkill: 1000,
    housing: 2000,
    gasoline: 264,
    food: 543,
    diligence: 1000,
    deductionItems: [
      { id: 'deduction-tisco', name: 'เงินกู้ TISCO', amount: 0 },
      { id: 'deduction-kys', name: 'K.Y.S.', amount: 432 },
      { id: 'deduction-tax', name: 'ภาษี', amount: 153 },
      { id: 'deduction-other', name: 'รายการหักอื่น', amount: 0 }
    ]
  });

  const elements = {
    inputs: Array.from(document.querySelectorAll('[data-field]')),
    autosaveStatus: document.getElementById('autosaveStatus'),
    toast: document.getElementById('toast'),
    recordsBody: document.getElementById('recordsBody'),
    emptyRecords: document.getElementById('emptyRecords'),
    emptyChart: document.getElementById('emptyChart'),
    historyChart: document.getElementById('historyChart'),
    importJsonInput: document.getElementById('importJsonInput'),
    settingsPanel: document.getElementById('settingsPanel'),
    deductionItemsList: document.getElementById('deductionItemsList'),
    deductionItemsEmpty: document.getElementById('deductionItemsEmpty'),
    summaryDynamicDeductions: document.getElementById('summaryDynamicDeductions')
  };

  let state = loadCurrentState();
  let records = loadRecords();
  let currentResult = null;
  let saveTimer = null;
  let toastTimer = null;

  function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function normalizeDeductionItems(items) {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id || createId()),
        name: String(item.name ?? item.label ?? ''),
        amount: safeNumber(item.amount ?? item.value)
      }));
  }

  function normalizeState(raw) {
    const base = createBaseConfiguration();
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = {
      ...base,
      deductionItems: createDefaultDeductionItems()
    };

    Object.keys(base).forEach((key) => {
      if (key === 'deductionItems' || !(key in source)) return;
      if (numericFields.has(key)) {
        normalized[key] = safeNumber(source[key]);
      } else if (booleanFields.has(key)) {
        normalized[key] = Boolean(source[key]);
      } else {
        normalized[key] = String(source[key] ?? '');
      }
    });

    if (Array.isArray(source.deductionItems)) {
      normalized.deductionItems = normalizeDeductionItems(source.deductionItems);
    } else {
      const legacyKeys = ['tiscoLoan', 'kys', 'tax', 'otherDeduction'];
      const hasLegacyDeductions = legacyKeys.some((key) => key in source);
      if (hasLegacyDeductions) {
        normalized.deductionItems = [
          { id: 'deduction-tisco', name: 'เงินกู้ TISCO', amount: safeNumber(source.tiscoLoan) },
          { id: 'deduction-kys', name: 'K.Y.S.', amount: safeNumber(source.kys) },
          { id: 'deduction-tax', name: 'ภาษี', amount: safeNumber(source.tax) },
          { id: 'deduction-other', name: 'รายการหักอื่น', amount: safeNumber(source.otherDeduction) }
        ];
      }
    }

    if (!/^\d{4}-\d{2}$/.test(normalized.periodMonth)) {
      normalized.periodMonth = currentMonth();
    }

    return normalized;
  }

  function loadCurrentState() {
    try {
      const saved = localStorage.getItem(STORAGE_CURRENT);
      return saved ? normalizeState(JSON.parse(saved)) : createSampleState();
    } catch (error) {
      console.warn('Cannot load current payroll state:', error);
      return createSampleState();
    }
  }

  function loadRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_RECORDS);
      const parsed = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === 'object' && item.state)
        .map((item) => {
          const normalizedState = normalizeState(item.state);
          return {
            ...item,
            state: normalizedState,
            result: calculatePayroll(normalizedState)
          };
        });
    } catch (error) {
      console.warn('Cannot load payroll records:', error);
      return [];
    }
  }

  function persistCurrentState() {
    try {
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify(state));
      elements.autosaveStatus.textContent = 'บันทึกอัตโนมัติแล้ว';
      elements.autosaveStatus.classList.remove('saving');
    } catch (error) {
      elements.autosaveStatus.textContent = 'บันทึกอัตโนมัติไม่ได้';
      elements.autosaveStatus.classList.remove('saving');
      console.warn('Cannot save payroll state:', error);
    }
  }

  function persistRecords() {
    try {
      localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records));
    } catch (error) {
      console.warn('Cannot save payroll records:', error);
      showToast('ไม่สามารถบันทึกประวัติในเบราว์เซอร์ได้', true);
    }
  }

  function scheduleAutosave() {
    elements.autosaveStatus.textContent = 'กำลังบันทึก…';
    elements.autosaveStatus.classList.add('saving');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistCurrentState, 350);
  }

  function syncInputsFromState() {
    elements.inputs.forEach((input) => {
      const key = input.dataset.field;
      if (!(key in state)) return;
      if (input.type === 'checkbox') {
        input.checked = Boolean(state[key]);
      } else {
        input.value = state[key];
      }
    });
    renderDeductionItems();
    updateCalculationModeControls();
  }

  function updateCalculationModeControls() {
    const pvdManual = document.querySelector('[data-field="pvdManual"]');
    const pvdRate = document.querySelector('[data-field="pvdRate"]');
    const socialManual = document.querySelector('[data-field="socialManual"]');
    const socialRate = document.querySelector('[data-field="socialRate"]');
    const socialMaxBase = document.querySelector('[data-field="socialMaxBase"]');

    pvdManual.disabled = state.pvdEnabled;
    pvdRate.disabled = !state.pvdEnabled;
    socialManual.disabled = state.socialEnabled;
    socialRate.disabled = !state.socialEnabled;
    socialMaxBase.disabled = !state.socialEnabled;
  }

  function renderDeductionItems() {
    const items = Array.isArray(state.deductionItems) ? state.deductionItems : [];
    elements.deductionItemsList.replaceChildren();
    elements.deductionItemsEmpty.hidden = items.length > 0;

    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'deduction-item';
      row.dataset.deductionId = item.id;

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'deduction-name-input';
      nameInput.value = item.name;
      nameInput.placeholder = 'ชื่อรายการหัก';
      nameInput.dataset.deductionProperty = 'name';
      nameInput.setAttribute('aria-label', `ชื่อรายการหักลำดับที่ ${index + 1}`);

      const amountWrap = document.createElement('div');
      amountWrap.className = 'input-affix prefix deduction-amount-affix';
      const currency = document.createElement('span');
      currency.textContent = '฿';
      const amountInput = document.createElement('input');
      amountInput.type = 'number';
      amountInput.min = '0';
      amountInput.step = '0.01';
      amountInput.inputMode = 'decimal';
      amountInput.value = item.amount;
      amountInput.dataset.deductionProperty = 'amount';
      amountInput.setAttribute('aria-label', `จำนวนเงินรายการหักลำดับที่ ${index + 1}`);
      amountWrap.append(currency, amountInput);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'deduction-remove-button';
      removeButton.dataset.removeDeduction = item.id;
      removeButton.title = 'ลบรายการหัก';
      removeButton.setAttribute('aria-label', `ลบรายการหัก ${item.name || `ลำดับที่ ${index + 1}`}`);
      removeButton.textContent = '×';

      row.append(nameInput, amountWrap, removeButton);
      elements.deductionItemsList.append(row);
    });
  }

  function addDeductionItem() {
    const item = {
      id: createId(),
      name: '',
      amount: 0
    };
    state.deductionItems.push(item);
    renderDeductionItems();
    updateDashboard();
    scheduleAutosave();

    const lastRow = elements.deductionItemsList.lastElementChild;
    lastRow?.querySelector('.deduction-name-input')?.focus();
  }

  function removeDeductionItem(id) {
    const item = state.deductionItems.find((entry) => entry.id === id);
    if (!item) return;
    state.deductionItems = state.deductionItems.filter((entry) => entry.id !== id);
    renderDeductionItems();
    updateDashboard();
    scheduleAutosave();
    showToast(`ลบ ${item.name || 'รายการหัก'} แล้ว`);
  }

  function onDeductionItemInput(event) {
    const input = event.target.closest('[data-deduction-property]');
    if (!input) return;
    const row = input.closest('[data-deduction-id]');
    const item = state.deductionItems.find((entry) => entry.id === row?.dataset.deductionId);
    if (!item) return;

    const property = input.dataset.deductionProperty;
    if (property === 'amount') {
      item.amount = safeNumber(input.value);
    } else if (property === 'name') {
      item.name = input.value;
    }

    updateDashboard();
    scheduleAutosave();
  }

  function onDeductionItemClick(event) {
    const button = event.target.closest('[data-remove-deduction]');
    if (!button) return;
    removeDeductionItem(button.dataset.removeDeduction);
  }

  function calculatePayroll(sourceState = state) {
    const s = normalizeState(sourceState);
    const salary = safeNumber(s.monthlySalary);
    const standardDays = safeNumber(s.standardDays);
    const hoursPerDay = safeNumber(s.hoursPerDay);

    const dailyRate = standardDays > 0 ? salary / standardDays : 0;
    const hourlyRate = hoursPerDay > 0 ? dailyRate / hoursPerDay : 0;
    const minuteRate = hourlyRate / 60;

    const normalDayPay = dailyRate * safeNumber(s.normalDays);
    const normalOtPay = minuteRate * safeNumber(s.normalOtMinutes) * safeNumber(s.normalOtRate);
    const saturdayDayPay = dailyRate * safeNumber(s.saturdayDays) * safeNumber(s.saturdayDayRate);
    const saturdayOtPay = minuteRate * safeNumber(s.saturdayOtMinutes) * safeNumber(s.saturdayOtRate);
    const sundayDayPay = dailyRate * safeNumber(s.sundayDays) * safeNumber(s.sundayDayRate);
    const sundayOtPay = minuteRate * safeNumber(s.sundayOtMinutes) * safeNumber(s.sundayOtRate);

    const vacationPay = dailyRate * safeNumber(s.vacationDays) * safeNumber(s.vacationRate);
    const allowanceTotal = [
      s.specialSkill,
      s.housing,
      s.language,
      s.gasoline,
      s.food,
      s.diligence,
      s.otherIncome,
      s.medical,
      s.attendanceFull,
      s.attendancePartial,
      vacationPay
    ].reduce((sum, value) => sum + safeNumber(value), 0);

    const otTotal = normalOtPay + saturdayOtPay + sundayOtPay;
    const weekendDayTotal = saturdayDayPay + sundayDayPay;
    const grossIncome = normalDayPay + otTotal + weekendDayTotal + allowanceTotal;

    const pvdDeduction = s.pvdEnabled
      ? salary * (safeNumber(s.pvdRate) / 100)
      : safeNumber(s.pvdManual);

    const socialBaseLimit = safeNumber(s.socialMaxBase);
    const socialBase = socialBaseLimit > 0 ? Math.min(salary, socialBaseLimit) : salary;
    const socialDeduction = s.socialEnabled
      ? socialBase * (safeNumber(s.socialRate) / 100)
      : safeNumber(s.socialManual);

    const unpaidDeduction = dailyRate * safeNumber(s.unpaidLeaveDays);
    const lateDeduction = minuteRate * safeNumber(s.lateMinutes) * safeNumber(s.lateRate);
    const deductionItems = normalizeDeductionItems(s.deductionItems);
    const customDeductionTotal = deductionItems.reduce((sum, item) => sum + safeNumber(item.amount), 0);
    const automaticDeductionTotal = pvdDeduction + socialDeduction + unpaidDeduction + lateDeduction;
    const totalDeduction = customDeductionTotal + automaticDeductionTotal;
    const netPay = grossIncome - totalDeduction;
    const totalOtMinutes = safeNumber(s.normalOtMinutes) + safeNumber(s.saturdayOtMinutes) + safeNumber(s.sundayOtMinutes);

    return {
      dailyRate,
      hourlyRate,
      minuteRate,
      normalDayPay,
      normalOtPay,
      saturdayDayPay,
      saturdayOtPay,
      sundayDayPay,
      sundayOtPay,
      vacationPay,
      allowanceTotal,
      otTotal,
      weekendDayTotal,
      grossIncome,
      pvdDeduction,
      socialDeduction,
      socialBase,
      unpaidDeduction,
      lateDeduction,
      deductionItems,
      customDeductionTotal,
      automaticDeductionTotal,
      totalDeduction,
      netPay,
      totalOtMinutes
    };
  }

  function formatMoney(value) {
    const number = Number.isFinite(Number(value)) ? Number(value) : 0;
    return moneyFormatter.format(number);
  }

  function formatPercent(value) {
    const number = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `${numberFormatter.format(number)}%`;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setMoney(id, value) {
    setText(id, formatMoney(value));
  }

  function updateDashboard() {
    currentResult = calculatePayroll(state);
    const r = currentResult;

    setMoney('heroNetPay', r.netPay);
    setMoney('heroGross', r.grossIncome);
    setMoney('heroDeduction', r.totalDeduction);

    setMoney('kpiGross', r.grossIncome);
    setMoney('kpiOt', r.otTotal);
    setText('kpiOtMinutes', `${integerFormatter.format(r.totalOtMinutes)} นาที`);
    setMoney('kpiDeduction', r.totalDeduction);
    setMoney('kpiNet', r.netPay);

    const deductionRate = r.grossIncome > 0 ? (r.totalDeduction / r.grossIncome) * 100 : 0;
    const netRate = r.grossIncome > 0 ? (r.netPay / r.grossIncome) * 100 : 0;
    setText('kpiDeductionRate', `${formatPercent(deductionRate)} ของรายได้`);
    setText('kpiNetRate', `รับสุทธิ ${formatPercent(netRate)}`);

    const financePlanBase = Math.max(r.netPay, 0);
    setMoney('financePlanBase', financePlanBase);
    setMoney('financePlanNeeds', financePlanBase * 0.5);
    setMoney('financePlanWants', financePlanBase * 0.3);
    setMoney('financePlanSavings', financePlanBase * 0.2);
    setText('financePlanMonth', monthLabel(state.periodMonth));
    setText(
      'financePlanNote',
      r.netPay > 0
        ? 'คำนวณจากเงินสุทธิหลังหักรายการทั้งหมดของเดือนนี้ และสามารถส่งต่อไปยัง Dashboard การเงินได้ทันที'
        : 'เมื่อเงินสุทธิมากกว่า 0 ระบบจะแสดงงบ 50/30/20 และสามารถส่งต่อไปยัง Dashboard การเงินได้'
    );

    setMoney('dailyRate', r.dailyRate);
    setMoney('hourlyRate', r.hourlyRate);
    setMoney('minuteRate', r.minuteRate);

    setText('normalOtRateLabel', trimNumber(state.normalOtRate));
    setText('saturdayDayRateLabel', trimNumber(state.saturdayDayRate));
    setText('saturdayOtRateLabel', trimNumber(state.saturdayOtRate));
    setText('sundayDayRateLabel', trimNumber(state.sundayDayRate));
    setText('sundayOtRateLabel', trimNumber(state.sundayOtRate));

    setMoney('normalDayPay', r.normalDayPay);
    setMoney('normalOtPay', r.normalOtPay);
    setMoney('saturdayDayPay', r.saturdayDayPay);
    setMoney('saturdayOtPay', r.saturdayOtPay);
    setMoney('sundayDayPay', r.sundayDayPay);
    setMoney('sundayOtPay', r.sundayOtPay);

    setMoney('vacationPay', r.vacationPay);
    setMoney('allowanceTotal', r.allowanceTotal);
    setMoney('pvdDeduction', r.pvdDeduction);
    setMoney('socialDeduction', r.socialDeduction);
    setMoney('unpaidDeduction', r.unpaidDeduction);
    setMoney('lateDeduction', r.lateDeduction);
    setMoney('automaticDeductionTotal', r.automaticDeductionTotal);
    setMoney('deductionSectionTotal', r.totalDeduction);

    setText(
      'pvdDetail',
      state.pvdEnabled
        ? `${trimNumber(state.pvdRate)}% × ${formatMoney(state.monthlySalary)}`
        : 'ใช้จำนวนเงินแบบกำหนดเอง'
    );
    setText(
      'socialDetail',
      state.socialEnabled
        ? `${trimNumber(state.socialRate)}% × ${formatMoney(r.socialBase)}`
        : 'ใช้จำนวนเงินแบบกำหนดเอง'
    );

    setMoney('summaryNormalPay', r.normalDayPay);
    setMoney('summaryNormalOt', r.normalOtPay);
    setMoney('summarySaturdayDay', r.saturdayDayPay);
    setMoney('summarySaturdayOt', r.saturdayOtPay);
    setMoney('summarySundayDay', r.sundayDayPay);
    setMoney('summarySundayOt', r.sundayOtPay);
    setMoney('summaryAllowance', r.allowanceTotal);
    setMoney('summaryGross', r.grossIncome);
    renderSummaryDeductions(r.deductionItems);
    setMoney('summaryPvd', r.pvdDeduction);
    setMoney('summarySocial', r.socialDeduction);
    setMoney('summaryUnpaid', r.unpaidDeduction);
    setMoney('summaryLate', r.lateDeduction);
    setMoney('summaryDeductions', r.totalDeduction);
    setMoney('summaryNet', r.netPay);

    updateComposition(r);
    updatePrintPayslip();
  }

  function renderSummaryDeductions(items) {
    elements.summaryDynamicDeductions.replaceChildren();
    const visibleItems = items.filter((item) => safeNumber(item.amount) > 0.0001);
    const rows = visibleItems.length
      ? visibleItems
      : [{ name: 'รายการหักที่เพิ่มเอง', amount: 0, empty: true }];

    rows.forEach((item) => {
      const row = document.createElement('div');
      row.className = `summary-row${item.empty ? ' summary-empty-row' : ''}`;
      const label = document.createElement('span');
      label.textContent = item.name.trim() || 'รายการหัก';
      const value = document.createElement('b');
      value.textContent = formatMoney(item.amount);
      row.append(label, value);
      elements.summaryDynamicDeductions.append(row);
    });
  }

  function trimNumber(value) {
    const number = safeNumber(value);
    return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
  }

  function updateComposition(result) {
    const gross = result.grossIncome;
    const netShare = gross > 0 ? Math.max(0, Math.min(100, (result.netPay / gross) * 100)) : 0;
    const donutAngle = netShare * 3.6;
    const donut = document.getElementById('payDonut');
    donut.style.background = `conic-gradient(var(--net) 0deg ${donutAngle}deg, #f2a0a0 ${donutAngle}deg 360deg)`;
    setText('donutNetPercent', `${numberFormatter.format(netShare)}%`);
    setMoney('legendNet', result.netPay);
    setMoney('legendDeduction', result.totalDeduction);

    const pieces = [
      ['baseSegment', result.normalDayPay],
      ['otSegment', result.otTotal],
      ['weekendSegment', result.weekendDayTotal],
      ['allowanceSegment', result.allowanceTotal]
    ];

    pieces.forEach(([id, value]) => {
      const percent = gross > 0 ? Math.max(0, (value / gross) * 100) : 0;
      document.getElementById(id).style.width = `${percent}%`;
    });
  }

  function onFieldInput(event) {
    const input = event.currentTarget;
    const key = input.dataset.field;
    if (!key) return;

    if (input.type === 'checkbox') {
      state[key] = input.checked;
      updateCalculationModeControls();
    } else if (numericFields.has(key)) {
      state[key] = safeNumber(input.value);
    } else {
      state[key] = input.value;
    }

    updateDashboard();
    scheduleAutosave();
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle('error', isError);
    elements.toast.classList.add('show');
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 2600);
  }

  function replaceState(nextState, message) {
    state = normalizeState(nextState);
    syncInputsFromState();
    updateDashboard();
    persistCurrentState();
    if (message) showToast(message);
  }

  function saveCurrentRecord() {
    if (!state.periodMonth) {
      showToast('กรุณาระบุเดือนที่คำนวณ', true);
      return;
    }

    const existingIndex = records.findIndex((record) => record.state.periodMonth === state.periodMonth);

    if (existingIndex >= 0) {
      const shouldReplace = window.confirm('มีข้อมูลของเดือนนี้แล้ว ต้องการบันทึกทับหรือไม่?');
      if (!shouldReplace) return;
    }

    const record = {
      id: existingIndex >= 0 ? records[existingIndex].id : createId(),
      savedAt: new Date().toISOString(),
      state: normalizeState(state),
      result: calculatePayroll(state)
    };

    if (existingIndex >= 0) {
      records.splice(existingIndex, 1, record);
    } else {
      records.push(record);
    }

    persistRecords();
    renderRecords();
    showToast(existingIndex >= 0 ? 'อัปเดตข้อมูลเดือนนี้แล้ว' : 'บันทึกข้อมูลเดือนนี้แล้ว');
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function monthLabel(period, short = false) {
    if (!/^\d{4}-\d{2}$/.test(period || '')) return 'ไม่ระบุเดือน';
    const [year, month] = period.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    try {
      return new Intl.DateTimeFormat('th-TH', {
        month: short ? 'short' : 'long',
        year: 'numeric'
      }).format(date);
    } catch {
      return period;
    }
  }

  function renderRecords() {
    const sorted = [...records].sort((a, b) => {
      const periodCompare = String(b.state.periodMonth).localeCompare(String(a.state.periodMonth));
      if (periodCompare !== 0) return periodCompare;
      return String(b.savedAt).localeCompare(String(a.savedAt));
    });

    elements.recordsBody.replaceChildren();
    elements.emptyRecords.hidden = sorted.length > 0;

    sorted.forEach((record) => {
      const result = record.result || calculatePayroll(record.state);
      const row = document.createElement('tr');

      const monthCell = document.createElement('td');
      monthCell.textContent = monthLabel(record.state.periodMonth);

      const grossCell = document.createElement('td');
      grossCell.className = 'number-cell';
      grossCell.textContent = formatMoney(result.grossIncome);

      const deductionCell = document.createElement('td');
      deductionCell.className = 'number-cell';
      deductionCell.textContent = formatMoney(result.totalDeduction);

      const netCell = document.createElement('td');
      netCell.className = 'number-cell record-net';
      netCell.textContent = formatMoney(result.netPay);

      const actionCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const loadButton = document.createElement('button');
      loadButton.type = 'button';
      loadButton.className = 'icon-button';
      loadButton.title = 'เปิดข้อมูลนี้';
      loadButton.setAttribute('aria-label', `เปิดข้อมูล ${monthLabel(record.state.periodMonth)}`);
      loadButton.textContent = '↗';
      loadButton.addEventListener('click', () => {
        replaceState(record.state, 'เปิดข้อมูลที่บันทึกแล้ว');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'icon-button delete';
      deleteButton.title = 'ลบข้อมูลนี้';
      deleteButton.setAttribute('aria-label', `ลบข้อมูล ${monthLabel(record.state.periodMonth)}`);
      deleteButton.textContent = '×';
      deleteButton.addEventListener('click', () => deleteRecord(record.id));

      actions.append(loadButton, deleteButton);
      actionCell.append(actions);
      row.append(monthCell, grossCell, deductionCell, netCell, actionCell);
      elements.recordsBody.append(row);
    });

    drawHistoryChart();
  }

  function deleteRecord(id) {
    const record = records.find((item) => item.id === id);
    if (!record) return;
    const shouldDelete = window.confirm(`ลบข้อมูล ${monthLabel(record.state.periodMonth)} หรือไม่?`);
    if (!shouldDelete) return;
    records = records.filter((item) => item.id !== id);
    persistRecords();
    renderRecords();
    showToast('ลบข้อมูลแล้ว');
  }

  function clearAllRecords() {
    if (records.length === 0) {
      showToast('ยังไม่มีประวัติให้ล้าง');
      return;
    }
    const shouldClear = window.confirm('ต้องการลบประวัติเงินเดือนทั้งหมดหรือไม่? การดำเนินการนี้ย้อนกลับไม่ได้');
    if (!shouldClear) return;
    records = [];
    persistRecords();
    renderRecords();
    showToast('ล้างประวัติทั้งหมดแล้ว');
  }

  function drawHistoryChart() {
    const canvas = elements.historyChart;
    const context = canvas.getContext('2d');
    const chartRecords = [...records]
      .sort((a, b) => {
        const periodCompare = String(a.state.periodMonth).localeCompare(String(b.state.periodMonth));
        if (periodCompare !== 0) return periodCompare;
        return String(a.savedAt).localeCompare(String(b.savedAt));
      })
      .slice(-12);

    elements.emptyChart.hidden = chartRecords.length > 0;
    canvas.style.visibility = chartRecords.length > 0 ? 'visible' : 'hidden';

    const average = chartRecords.length
      ? chartRecords.reduce((sum, record) => sum + (record.result || calculatePayroll(record.state)).netPay, 0) / chartRecords.length
      : 0;
    setText('historyAverage', `เฉลี่ย ${formatMoney(average)}`);

    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(320, rect.width || 700);
    const cssHeight = 215;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    if (chartRecords.length === 0) return;

    const padding = { top: 16, right: 8, bottom: 38, left: 55 };
    const plotWidth = cssWidth - padding.left - padding.right;
    const plotHeight = cssHeight - padding.top - padding.bottom;
    const values = chartRecords.map((record) => (record.result || calculatePayroll(record.state)).netPay);
    const rawMax = Math.max(...values, 1);
    const rawMin = Math.min(...values, 0);
    const maxValue = rawMax > 0 ? rawMax * 1.12 : 1;
    const minValue = rawMin < 0 ? rawMin * 1.12 : 0;
    const range = Math.max(1, maxValue - minValue);

    context.font = '10px Inter, Arial, sans-serif';
    context.textBaseline = 'middle';
    context.strokeStyle = '#e3e9f0';
    context.fillStyle = '#8390a2';
    context.lineWidth = 1;

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i += 1) {
      const y = padding.top + (plotHeight / gridLines) * i;
      const value = maxValue - (range / gridLines) * i;
      context.beginPath();
      context.moveTo(padding.left, Math.round(y) + 0.5);
      context.lineTo(cssWidth - padding.right, Math.round(y) + 0.5);
      context.stroke();
      context.textAlign = 'right';
      context.fillText(`฿${compactFormatter.format(value)}`, padding.left - 8, y);
    }

    const slotWidth = plotWidth / chartRecords.length;
    const barWidth = Math.min(34, Math.max(10, slotWidth * 0.54));
    const zeroY = padding.top + ((maxValue - 0) / range) * plotHeight;

    chartRecords.forEach((record, index) => {
      const value = values[index];
      const valueY = padding.top + ((maxValue - value) / range) * plotHeight;
      const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
      const y = Math.min(valueY, zeroY);
      const height = Math.max(2, Math.abs(zeroY - valueY));

      const gradient = context.createLinearGradient(0, y, 0, y + height);
      if (value >= 0) {
        gradient.addColorStop(0, '#2563eb');
        gradient.addColorStop(1, '#64a1ff');
      } else {
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(1, '#fca5a5');
      }
      context.fillStyle = gradient;
      roundedRect(context, x, y, barWidth, height, Math.min(7, barWidth / 2));
      context.fill();

      context.fillStyle = '#64748b';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      const label = monthLabel(record.state.periodMonth, true).replace(/\s+/g, ' ');
      context.fillText(label, x + barWidth / 2, cssHeight - padding.bottom + 10);
    });
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportRecordsCsv() {
    if (records.length === 0) {
      showToast('กรุณาบันทึกข้อมูลอย่างน้อย 1 เดือนก่อนส่งออก CSV', true);
      return;
    }

    const headers = [
      'เดือน', 'เงินเดือนพื้นฐาน', 'OT รวม (นาที)', 'รายได้รวม',
      'รายละเอียดรายการหักที่เพิ่มเอง', 'รายการหักที่เพิ่มเองรวม',
      'กองทุนสำรองเลี้ยงชีพ', 'ประกันสังคม', 'หักลาไม่รับค่าจ้าง',
      'หักมาสาย', 'รายการหักรวม', 'เงินสุทธิ', 'วันที่บันทึก'
    ];

    const rows = [...records]
      .sort((a, b) => String(a.state.periodMonth).localeCompare(String(b.state.periodMonth)))
      .map((record) => {
        const result = record.result || calculatePayroll(record.state);
        const deductionDetails = result.deductionItems
          .filter((item) => safeNumber(item.amount) > 0.0001)
          .map((item) => `${item.name.trim() || 'รายการหัก'}: ${numberFormatter.format(item.amount)}`)
          .join(' | ');

        return [
          record.state.periodMonth,
          numberFormatter.format(record.state.monthlySalary),
          integerFormatter.format(result.totalOtMinutes),
          numberFormatter.format(result.grossIncome),
          deductionDetails,
          numberFormatter.format(result.customDeductionTotal),
          numberFormatter.format(result.pvdDeduction),
          numberFormatter.format(result.socialDeduction),
          numberFormatter.format(result.unpaidDeduction),
          numberFormatter.format(result.lateDeduction),
          numberFormatter.format(result.totalDeduction),
          numberFormatter.format(result.netPay),
          record.savedAt
        ];
      });

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    downloadFile(`salary-records-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
    showToast('ส่งออกไฟล์ CSV แล้ว');
  }

  function exportBackupJson() {
    const backup = {
      app: 'Monthly Salary Dashboard',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      current: state,
      records
    };
    downloadFile(
      `salary-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup, null, 2),
      'application/json;charset=utf-8'
    );
    showToast('สำรองข้อมูล JSON แล้ว');
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const importedRecords = Array.isArray(data) ? data : data.records;
      const importedCurrent = Array.isArray(data) ? null : data.current;

      if (!Array.isArray(importedRecords) && !importedCurrent) {
        throw new Error('Invalid backup format');
      }

      const shouldImport = window.confirm('นำเข้าข้อมูลจากไฟล์นี้และแทนที่ข้อมูลปัจจุบันหรือไม่?');
      if (!shouldImport) return;

      if (importedCurrent) {
        state = normalizeState(importedCurrent);
      }

      if (Array.isArray(importedRecords)) {
        records = importedRecords
          .filter((item) => item && typeof item === 'object' && item.state)
          .map((item) => ({
            id: item.id || createId(),
            savedAt: item.savedAt || new Date().toISOString(),
            state: normalizeState(item.state),
            result: calculatePayroll(item.state)
          }));
      }

      syncInputsFromState();
      updateDashboard();
      renderRecords();
      persistCurrentState();
      persistRecords();
      showToast('นำเข้าข้อมูลสำเร็จ');
    } catch (error) {
      console.error(error);
      showToast('ไฟล์ JSON ไม่ถูกต้องหรืออ่านข้อมูลไม่ได้', true);
    }
  }

  function updatePrintPayslip() {
    if (!currentResult) return;
    const r = currentResult;

    setText('printPeriod', monthLabel(state.periodMonth));
    setMoney('printSalary', state.monthlySalary);
    setMoney('printDailyRate', r.dailyRate);
    setMoney('printHourlyRate', r.hourlyRate);
    setMoney('printMinuteRate', r.minuteRate);
    setMoney('printGross', r.grossIncome);
    setMoney('printDeduction', r.totalDeduction);
    setMoney('printNet', r.netPay);

    const incomeRows = [
      ['ค่าจ้างวันทำงานปกติ', r.normalDayPay],
      ['OT วันปกติ', r.normalOtPay],
      ['ทำงานวันเสาร์', r.saturdayDayPay],
      ['OT วันเสาร์', r.saturdayOtPay],
      ['ทำงานวันอาทิตย์', r.sundayDayPay],
      ['OT วันอาทิตย์', r.sundayOtPay],
      ['รายได้เพิ่มเติม', r.allowanceTotal]
    ];

    const deductionRows = [
      ...r.deductionItems.map((item) => [item.name.trim() || 'รายการหัก', item.amount]),
      ['กองทุนสำรองเลี้ยงชีพ', r.pvdDeduction],
      ['ประกันสังคม', r.socialDeduction],
      ['ลาไม่รับค่าจ้าง', r.unpaidDeduction],
      ['มาสาย', r.lateDeduction]
    ];

    buildPrintRows('printIncomeRows', incomeRows);
    buildPrintRows('printDeductionRows', deductionRows);
  }

  function buildPrintRows(containerId, rows) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    const visibleRows = rows.filter(([, amount]) => Math.abs(Number(amount) || 0) > 0.0001);
    const rowsToRender = visibleRows.length ? visibleRows : [['ไม่มีรายการ', 0]];

    rowsToRender.forEach(([label, amount]) => {
      const row = document.createElement('div');
      row.className = 'print-line';
      const name = document.createElement('span');
      name.textContent = label;
      const value = document.createElement('b');
      value.textContent = formatMoney(amount);
      row.append(name, value);
      container.append(row);
    });
  }

  function openFinancePlanner() {
    const result = currentResult || calculatePayroll(state);
    const params = new URLSearchParams({
      source: 'payroll',
      month: state.periodMonth
    });

    if (result.netPay > 0) {
      params.set('net', result.netPay.toFixed(2));
      params.set('gross', result.grossIncome.toFixed(2));
      params.set('deduction', result.totalDeduction.toFixed(2));
    }

    window.location.href = `finance-50-30-20.html?${params.toString()}`;
  }

  function printPayslip() {
    updatePrintPayslip();
    window.print();
  }

  function loadImageSample() {
    const shouldLoad = window.confirm('โหลดตัวเลขตัวอย่างจากภาพต้นฉบับและแทนที่ข้อมูลที่กำลังกรอกหรือไม่?');
    if (!shouldLoad) return;
    replaceState(createSampleState(), 'โหลดตัวอย่างจากภาพแล้ว');
  }

  function resetForm() {
    const shouldReset = window.confirm('ล้างข้อมูลที่กำลังกรอกและคืนค่าการตั้งต้นหรือไม่? ประวัติที่บันทึกไว้จะยังคงอยู่');
    if (!shouldReset) return;
    replaceState(createBaseConfiguration(), 'คืนค่าเริ่มต้นแล้ว');
  }

  function verifySampleCalculation() {
    const sample = calculatePayroll(createSampleState());
    const expected = {
      grossIncome: 27004.121739130434,
      totalDeduction: 2803.51,
      netPay: 24200.611739130433
    };
    const tolerance = 0.001;
    const ok = Object.keys(expected).every((key) => Math.abs(sample[key] - expected[key]) < tolerance);
    if (!ok) console.warn('Sample calculation self-check failed', sample);
  }

  function attachEvents() {
    elements.inputs.forEach((input) => {
      input.addEventListener('input', onFieldInput);
      input.addEventListener('change', onFieldInput);
    });

    document.getElementById('saveRecordBtn').addEventListener('click', saveCurrentRecord);
    document.getElementById('openFinanceBtn').addEventListener('click', openFinancePlanner);
    document.getElementById('openFinancePanelBtn').addEventListener('click', openFinancePlanner);
    document.getElementById('addDeductionBtn').addEventListener('click', addDeductionItem);
    elements.deductionItemsList.addEventListener('input', onDeductionItemInput);
    elements.deductionItemsList.addEventListener('click', onDeductionItemClick);
    document.getElementById('printBtn').addEventListener('click', printPayslip);
    document.getElementById('loadSampleBtn').addEventListener('click', loadImageSample);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    document.getElementById('clearRecordsBtn').addEventListener('click', clearAllRecords);
    document.getElementById('exportCsvBtn').addEventListener('click', exportRecordsCsv);
    document.getElementById('exportJsonBtn').addEventListener('click', exportBackupJson);
    elements.importJsonInput.addEventListener('change', importBackup);

    window.addEventListener('beforeprint', updatePrintPayslip);
    window.addEventListener('resize', debounce(drawHistoryChart, 120));

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(debounce(drawHistoryChart, 80));
      observer.observe(elements.historyChart.parentElement);
    }
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  }

  function init() {
    syncInputsFromState();
    attachEvents();
    updateDashboard();
    renderRecords();
    persistCurrentState();
    verifySampleCalculation();
  }

  init();
})();
