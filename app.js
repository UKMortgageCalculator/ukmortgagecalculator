/**
 * UK Mortgage Calculator — Client-Side Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------------------------------
  // DOM ELEMENTS
  // ---------------------------------------------------------------------------
  const propertyPriceInput = document.getElementById('property-price');
  const depositWrapper = document.getElementById('deposit-wrapper');
  const depositInput = document.getElementById('deposit-input');
  const depositPrefix = document.getElementById('deposit-prefix');
  const depositSuffix = document.getElementById('deposit-suffix');
  const depositEquivalentEl = document.getElementById('deposit-equivalent-value');
  const btnUnitPercent = document.getElementById('btn-unit-percent');
  const btnUnitPound = document.getElementById('btn-unit-pound');

  const interestRateInput = document.getElementById('interest-rate');
  const termNumberInput = document.getElementById('mortgage-term-number');
  const termSliderInput = document.getElementById('mortgage-term-slider');
  const repaymentTypeRadios = document.querySelectorAll('input[name="repaymentType"]');

  // Summary and Output Elements
  const summaryLoanAmountEl = document.getElementById('summary-loan-amount');
  const summaryLtvEl = document.getElementById('summary-ltv');
  const outputMonthlyPaymentEl = document.getElementById('output-monthly-payment');
  const outputPaymentSubtextEl = document.getElementById('output-payment-subtext');
  const outputTotalRepayableEl = document.getElementById('output-total-repayable');
  const outputTotalInterestEl = document.getElementById('output-total-interest');

  const interestOnlyNote = document.getElementById('interest-only-note');
  const noteCapitalOwed = document.getElementById('note-capital-owed');

  // SVG Chart Elements
  const chartPrincipalSegment = document.getElementById('chart-principal-segment');
  const chartInterestSegment = document.getElementById('chart-interest-segment');
  const chartInterestPctEl = document.getElementById('chart-interest-pct');
  const chartPrincipalAmountEl = document.getElementById('chart-principal-amount');
  const chartInterestAmountEl = document.getElementById('chart-interest-amount');

  // Circle circumference for r=62: 2 * Math.PI * 62 = ~389.557
  const CIRCUMFERENCE = 2 * Math.PI * 62;

  // State variable
  let depositUnit = 'percent'; // 'percent' or 'pound'

  // ---------------------------------------------------------------------------
  // FORMATTERS
  // ---------------------------------------------------------------------------
  function formatCurrency(val) {
    const rounded = Math.round(val);
    return '£' + rounded.toLocaleString('en-GB');
  }

  function formatPercent(val) {
    return val.toFixed(1) + '%';
  }

  // ---------------------------------------------------------------------------
  // DEPOSIT UNIT TOGGLE
  // ---------------------------------------------------------------------------
  function setDepositUnit(unit) {
    if (depositUnit === unit) return;

    const currentPrice = parseFloat(propertyPriceInput.value) || 0;
    const currentVal = parseFloat(depositInput.value) || 0;

    if (unit === 'percent') {
      // Converting from Pound to Percent
      depositUnit = 'percent';
      btnUnitPercent.classList.add('active');
      btnUnitPound.classList.remove('active');
      depositWrapper.classList.remove('currency-wrapper');
      depositWrapper.classList.add('percent-wrapper');
      depositPrefix.style.display = 'none';
      depositSuffix.style.display = 'inline';

      let newPct = currentPrice > 0 ? (currentVal / currentPrice) * 100 : 10;
      newPct = Math.min(100, Math.max(0, Math.round(newPct * 10) / 10)); // 1 decimal place

      depositInput.value = newPct;
      depositInput.step = '0.5';
      depositInput.max = '100';
    } else {
      // Converting from Percent to Pound
      depositUnit = 'pound';
      btnUnitPound.classList.add('active');
      btnUnitPercent.classList.remove('active');
      depositWrapper.classList.remove('percent-wrapper');
      depositWrapper.classList.add('currency-wrapper');
      depositPrefix.style.display = 'inline';
      depositSuffix.style.display = 'none';

      let newPound = currentPrice * (currentVal / 100);
      newPound = Math.min(currentPrice, Math.max(0, Math.round(newPound / 100) * 100)); // round to 100s

      depositInput.value = newPound;
      depositInput.step = '1000';
      depositInput.max = currentPrice.toString();
    }

    calculateMortgage();
  }

  btnUnitPercent.addEventListener('click', () => setDepositUnit('percent'));
  btnUnitPound.addEventListener('click', () => setDepositUnit('pound'));

  // ---------------------------------------------------------------------------
  // MORTGAGE CALCULATION ENGINE
  // ---------------------------------------------------------------------------
  function calculateMortgage() {
    const price = parseFloat(propertyPriceInput.value) || 0;
    const depositRaw = parseFloat(depositInput.value) || 0;
    const annualRate = parseFloat(interestRateInput.value) || 0;
    const termYears = parseInt(termNumberInput.value, 10) || 25;
    
    let selectedRepaymentType = 'repayment';
    repaymentTypeRadios.forEach(radio => {
      if (radio.checked) selectedRepaymentType = radio.value;
    });

    // 1. Calculate Deposit Amount & Equivalent Display
    let depositPound = 0;
    let depositPercent = 0;

    if (depositUnit === 'percent') {
      depositPercent = Math.min(100, Math.max(0, depositRaw));
      depositPound = price * (depositPercent / 100);
      depositEquivalentEl.textContent = formatCurrency(depositPound);
    } else {
      depositPound = Math.min(price, Math.max(0, depositRaw));
      depositPercent = price > 0 ? (depositPound / price) * 100 : 0;
      depositEquivalentEl.textContent = formatPercent(depositPercent);
    }

    // 2. Loan Amount & LTV
    const loanAmount = Math.max(0, price - depositPound);
    const ltv = price > 0 ? (loanAmount / price) * 100 : 0;

    summaryLoanAmountEl.textContent = formatCurrency(loanAmount);
    summaryLtvEl.textContent = formatPercent(ltv);

    // 3. Repayment Calculations
    const n = termYears * 12; // Total monthly payments
    const r = (annualRate / 100) / 12; // Monthly interest rate

    let monthlyPayment = 0;
    let totalInterestPaid = 0;
    let totalRepayable = 0;

    if (selectedRepaymentType === 'repayment') {
      interestOnlyNote.style.display = 'none';
      
      if (loanAmount <= 0 || n <= 0) {
        monthlyPayment = 0;
        totalRepayable = 0;
        totalInterestPaid = 0;
      } else if (r === 0) {
        // Zero interest edge case fallback
        monthlyPayment = loanAmount / n;
        totalRepayable = loanAmount;
        totalInterestPaid = 0;
      } else {
        // Standard amortising repayment formula: M = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
        const compound = Math.pow(1 + r, n);
        monthlyPayment = loanAmount * ((r * compound) / (compound - 1));
        totalRepayable = monthlyPayment * n;
        totalInterestPaid = Math.max(0, totalRepayable - loanAmount);
      }
    } else {
      // Interest-Only Mortgage formula
      interestOnlyNote.style.display = 'flex';
      noteCapitalOwed.textContent = formatCurrency(loanAmount);

      monthlyPayment = loanAmount * r;
      totalInterestPaid = monthlyPayment * n;
      totalRepayable = totalInterestPaid + loanAmount;
    }

    // 4. Update UI Results
    outputMonthlyPaymentEl.textContent = Math.round(monthlyPayment).toLocaleString('en-GB');
    outputPaymentSubtextEl.textContent = `per month for ${termYears} years`;
    outputTotalRepayableEl.textContent = formatCurrency(totalRepayable);
    outputTotalInterestEl.textContent = formatCurrency(totalInterestPaid);

    // 5. Update SVG Donut Chart
    updateChart(loanAmount, totalInterestPaid, totalRepayable);
  }

  // ---------------------------------------------------------------------------
  // SVG CHART RENDERER
  // ---------------------------------------------------------------------------
  function updateChart(principal, interest, totalRepayable) {
    chartPrincipalAmountEl.textContent = formatCurrency(principal);
    chartInterestAmountEl.textContent = formatCurrency(interest);

    if (totalRepayable <= 0) {
      chartPrincipalSegment.style.strokeDasharray = `0 ${CIRCUMFERENCE}`;
      chartInterestSegment.style.strokeDasharray = `0 ${CIRCUMFERENCE}`;
      chartInterestPctEl.textContent = '0%';
      return;
    }

    const principalPct = principal / totalRepayable;
    const interestPct = interest / totalRepayable;

    const principalDash = principalPct * CIRCUMFERENCE;
    const interestDash = interestPct * CIRCUMFERENCE;

    // Principal starts at top (-90deg), interest segment offsets right after principal
    chartPrincipalSegment.style.strokeDasharray = `${principalDash} ${CIRCUMFERENCE}`;
    chartPrincipalSegment.style.strokeDashoffset = '0';

    chartInterestSegment.style.strokeDasharray = `${interestDash} ${CIRCUMFERENCE}`;
    chartInterestSegment.style.strokeDashoffset = `-${principalDash}`;

    chartInterestPctEl.textContent = Math.round(interestPct * 100) + '%';
  }

  // ---------------------------------------------------------------------------
  // EVENT LISTENERS & SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  // Sync Term Slider & Number input
  termSliderInput.addEventListener('input', (e) => {
    termNumberInput.value = e.target.value;
    calculateMortgage();
  });

  termNumberInput.addEventListener('input', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    val = Math.min(35, Math.max(5, val));
    termSliderInput.value = val;
    calculateMortgage();
  });

  termNumberInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 5) val = 5;
    if (val > 35) val = 35;
    e.target.value = val;
    termSliderInput.value = val;
    calculateMortgage();
  });

  // Listen for changes on form inputs
  [propertyPriceInput, depositInput, interestRateInput].forEach(input => {
    input.addEventListener('input', calculateMortgage);
  });

  repaymentTypeRadios.forEach(radio => {
    radio.addEventListener('change', calculateMortgage);
  });

  // Initial Calculation on Page Load
  calculateMortgage();
});
