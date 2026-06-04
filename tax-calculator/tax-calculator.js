// ──────────────────────────────────────
//  PFA Tax Calculator — Romania
// ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ────────────────────────
  const grossMinSalaryInput = document.getElementById('tc-gross-min-salary');
  const totalIncomeInput    = document.getElementById('tc-total-income');
  const deductibleInput     = document.getElementById('tc-deductible-expenses');

  const netIncomeSpan       = document.getElementById('tc-net-income');
  const grossIncomeSpan     = document.getElementById('tc-gross-income');
  const healthcareSpan      = document.getElementById('tc-healthcare-tax');
  const pensionSpan         = document.getElementById('tc-pension-tax');
  const incomeTaxSpan       = document.getElementById('tc-income-tax');
  const totalTaxSpan        = document.getElementById('tc-total-tax');
  const effectiveRateSpan   = document.getElementById('tc-effective-rate');
  const takeHomeSpan        = document.getElementById('tc-take-home');
  const monthlyGrossSpan    = document.getElementById('tc-monthly-gross');
  const monthlyTakeHomeSpan = document.getElementById('tc-monthly-take-home');
  const monthlyTaxSpan      = document.getElementById('tc-monthly-tax');
  const sweetSpotDiv        = document.getElementById('tc-sweet-spot');

  // ── Chart instances ────────────────
  let overviewChart = null;
  let breakdownChart = null;

  // ── Formatting helpers ─────────────
  const fmtRON = (val) => {
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(val);
    }
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 3, minimumFractionDigits: 0 }).format(val);
  };

  const fmtPct = (val) => {
    const rounded = Math.round(val * 100) / 100;
    return rounded.toFixed(2).replace(/\.?0+$/, '') + '%';
  };

  // ── Core tax calculation ───────────
  function calculateTaxes(grossMinSalary, totalIncome, deductibleExpenses) {
    const netIncome = Math.max(0, totalIncome - deductibleExpenses);

    // ── Healthcare (CASS) ──
    let healthcareTax;
    if (netIncome <= 0) {
      healthcareTax = 0;
    } else {
      const rawTax = 0.10 * netIncome;
      const capThreshold = 72 * grossMinSalary;

      if (netIncome > capThreshold) {
        healthcareTax = 0.10 * capThreshold;
      } else if (rawTax < 2430) {
        healthcareTax = 2430;
      } else {
        healthcareTax = rawTax;
      }
    }

    // ── Pension (CAS) ──
    let pensionTax;
    const bracket12 = 12 * grossMinSalary;
    const bracket24 = 24 * grossMinSalary;

    if (netIncome < bracket12) {
      pensionTax = 0;
    } else if (netIncome <= bracket24) {
      pensionTax = 0.25 * bracket12; // constant: 25% of 12 salaries
    } else {
      pensionTax = 0.25 * bracket24; // constant: 25% of 24 salaries
    }

    // ── Income tax ──
    const taxableBase = Math.max(0, netIncome - pensionTax - healthcareTax);
    const incomeTax = taxableBase / 10;

    const totalTax = healthcareTax + pensionTax + incomeTax;
    const takeHome = totalIncome - deductibleExpenses - totalTax;
    const effectiveRate = totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;

    return {
      netIncome,
      healthcareTax,
      pensionTax,
      incomeTax,
      totalTax,
      takeHome,
      effectiveRate
    };
  }

  // ── Sweet spot analysis ────────────
  function computeSweetSpot(grossMinSalary, totalIncome, deductibleExpenses) {
    // Check if already in a sweet spot — return immediately
    for (const range of sweetSpotRanges) {
      const start = xToIncome(range.xStart);
      const end = xToIncome(range.xEnd);
      if (totalIncome >= start && totalIncome <= end) {
        return [{ direction: 'in', label: "You're in the sweet spot!", netEffect: '', extraAmount: 0 }];
      }
    }

    const currentNet = totalIncome - deductibleExpenses;
    const bracket12 = 12 * grossMinSalary;
    const bracket24 = 24 * grossMinSalary;
    const cap72 = 72 * grossMinSalary;

    const candidates = [];

    // Helper: get sweet spot start income from pre-computed ranges (overview chart)
    function getSweetStart(cliffIncome) {
      const range = sweetSpotRanges.find(r => {
        const endIncome = xToIncome(r.xEnd);
        return Math.abs(endIncome - cliffIncome) < 1000;
      });
      return range ? xToIncome(range.xStart) : null;
    }

    // ── 12× pension cliff ──
    const sweet12Start = getSweetStart(bracket12);
    if (sweet12Start !== null && totalIncome < sweet12Start) {
      candidates.push({
        extraAmount: sweet12Start - totalIncome,
        direction: 'earn',
        label: 'Earn <strong>' + fmtRON(sweet12Start - totalIncome) + '</strong> more to reach 12× pension sweet spot',
        netEffect: 'no pension tax until ' + formatIncomeLabel(bracket12)
      });
    }
    if (currentNet >= bracket12) {
      const neededDeduct = currentNet - bracket12 + 1;
      if (totalIncome - (deductibleExpenses + neededDeduct) >= 0) {
        candidates.push({
          extraAmount: neededDeduct,
          direction: 'deduct',
          label: 'Deduct <strong>' + fmtRON(neededDeduct) + '</strong> to drop below 12× pension bracket',
          netEffect: 'pension tax → 0 RON'
        });
      }
    }

    // ── 24× pension cliff ──
    const sweet24Start = getSweetStart(bracket24);
    if (sweet24Start !== null && totalIncome < sweet24Start) {
      const needed = sweet24Start - totalIncome;
      if (needed > 0) {
        candidates.push({
          extraAmount: needed,
          direction: 'earn',
          label: 'Earn <strong>' + fmtRON(needed) + '</strong> more to reach 24× pension sweet spot',
          netEffect: 'lower pension constant at ' + formatIncomeLabel(bracket24)
        });
      }
    }
    if (currentNet > bracket24) {
      const neededDeduct = currentNet - bracket24;
      candidates.push({
        extraAmount: neededDeduct,
        direction: 'deduct',
        label: 'Deduct <strong>' + fmtRON(neededDeduct) + '</strong> to drop from 24× to 12-24× pension bracket',
        netEffect: 'lower pension tax constant'
      });
    }

    // ── 72× CASS cap ──
    if (currentNet > cap72) {
      const neededDeduct = currentNet - cap72;
      candidates.push({
        extraAmount: neededDeduct,
        direction: 'deduct',
        label: 'Deduct <strong>' + fmtRON(neededDeduct) + '</strong> to drop below 72× CASS cap',
        netEffect: 'CASS stays percentage-based'
      });
    }

    // ── End-of-chart sweet spot ──
    const sweetEndStart = getSweetStart(1000000);
    if (sweetEndStart !== null && totalIncome < sweetEndStart && totalIncome > bracket24) {
      const needed = sweetEndStart - totalIncome;
      if (needed > 0) {
        candidates.push({
          extraAmount: needed,
          direction: 'earn',
          label: 'Earn <strong>' + fmtRON(needed) + '</strong> more to reach end-of-chart sweet spot',
          netEffect: 'lowest effective rate zone'
        });
      }
    }

    // Return only the closest suggestion (smallest RON movement)
    candidates.sort((a, b) => a.extraAmount - b.extraAmount);
    return candidates.slice(0, 1);
  }

  // ── Input validation ───────────────
  function validateInputs() {
    let gms = parseFloat(grossMinSalaryInput.value);
    let income = parseFloat(totalIncomeInput.value);
    let deduct = parseFloat(deductibleInput.value);

    // GMS: must be 100–100000
    if (isNaN(gms) || gms < 100 || gms > 100000) {
      grossMinSalaryInput.classList.add('tc-input--invalid');
      gms = 0;
    } else {
      grossMinSalaryInput.classList.remove('tc-input--invalid');
    }

    // Total income: must be 0–10,000,000
    if (isNaN(income) || income < 0 || income > 10000000) {
      totalIncomeInput.classList.add('tc-input--invalid');
      income = 0;
    } else {
      totalIncomeInput.classList.remove('tc-input--invalid');
    }

    // Deductible expenses: must be 0–10,000,000
    if (isNaN(deduct) || deduct < 0 || deduct > 10000000) {
      deductibleInput.classList.add('tc-input--invalid');
      deduct = 0;
    } else {
      deductibleInput.classList.remove('tc-input--invalid');
    }

    return { gms, income, deduct };
  }

  // ── Update UI ──────────────────────
  function updateCalculator() {
    const { gms, income, deduct } = validateInputs();
    const grossMinSalary = gms || 4050; // fallback for display only
    const totalIncome    = income;
    const deductible     = deduct;

    const t = calculateTaxes(grossMinSalary, totalIncome, deductible);

    const setHL = (span, val, gray) => {
      span.textContent = val;
      span.style.color = gray ? '#555' : '#ecb063';
      span.parentElement.style.borderColor = gray ? '#555' : '#ecb063';
    };
    const setCard = (span, val, gray) => {
      span.textContent = val;
      span.style.color = gray ? '#555' : '#e0e0e0';
      span.parentElement.style.borderColor = gray ? '#555' : '#333';
    };
    const isZero = totalIncome === 0;

    setCard(netIncomeSpan, fmtRON(t.netIncome), t.netIncome === 0);
    setCard(grossIncomeSpan, fmtRON(totalIncome), isZero);
    setCard(healthcareSpan, fmtRON(t.healthcareTax), t.healthcareTax === 0);
    setCard(pensionSpan, fmtRON(t.pensionTax), t.pensionTax === 0);
    setCard(incomeTaxSpan, fmtRON(t.incomeTax), t.incomeTax === 0);
    setHL(totalTaxSpan, fmtRON(t.totalTax), t.totalTax === 0);
    setHL(effectiveRateSpan, fmtPct(t.effectiveRate), isZero);
    takeHomeSpan.textContent = (t.takeHome < 0 ? '−' : '') + fmtRON(Math.abs(t.takeHome));
    if (t.takeHome < 0) {
      takeHomeSpan.style.color = '#d44';
      takeHomeSpan.parentElement.style.borderColor = '#d44';
    } else {
      setHL(takeHomeSpan, (t.takeHome < 0 ? '−' : '') + fmtRON(Math.abs(t.takeHome)), t.takeHome === 0);
    }
    setCard(monthlyGrossSpan, fmtRON(totalIncome / 12), isZero);
    monthlyTakeHomeSpan.textContent = (t.takeHome < 0 ? '−' : '') + fmtRON(Math.abs(t.takeHome / 12));
    if (t.takeHome < 0) {
      monthlyTakeHomeSpan.style.color = '#d44';
      monthlyTakeHomeSpan.parentElement.style.borderColor = '#d44';
    } else {
      setCard(monthlyTakeHomeSpan, (t.takeHome < 0 ? '−' : '') + fmtRON(Math.abs(t.takeHome / 12)), t.takeHome === 0);
    }
    setCard(monthlyTaxSpan, fmtRON(t.totalTax / 12), t.totalTax === 0);

    // ── Sweet spot ──
    const spots = computeSweetSpot(grossMinSalary, totalIncome, deductible);
    if (spots.length > 0) {
      if (spots[0].direction === 'in') {
        sweetSpotDiv.innerHTML = '<h3>Sweet Spot Analysis</h3><p style="color:#50c878">' + spots[0].label + '</p>';
      } else {
        sweetSpotDiv.innerHTML = '<h3>Sweet Spot Analysis</h3>' +
          spots.map(s =>
            `<div class="tc-sweet-item">
              <span>${s.label}</span>
              <span class="tc-value" style="font-size:0.75rem;color:#777">${s.netEffect || ''}</span>
            </div>`
          ).join('');
      }
    } else {
      sweetSpotDiv.innerHTML = '<h3>Sweet Spot Analysis</h3><p>No actionable sweet spot.</p>';
    }

    // ── Update breakdown chart ──
    updateBreakdownChart(t, deductible);
  }

  // ── Non-linear x-axis helpers ──────
  // 0 to 72×GMS  → 0%–75% of chart width
  // 72×GMS to 1M → 75%–100% of chart width
  let kneeIncome = 72 * 4050; // updated when GMS changes
  let incomeToX, xToIncome;

  function rebuildMapping(gms) {
    kneeIncome = 72 * gms;
    incomeToX = (income) => {
      if (income <= kneeIncome) {
        return (income / kneeIncome) * 0.75;
      } else {
        return 0.75 + ((income - kneeIncome) / (1000000 - kneeIncome)) * 0.25;
      }
    };
    xToIncome = (x) => {
      if (x <= 0.75) {
        return Math.round((x / 0.75) * kneeIncome);
      } else {
        return Math.round(kneeIncome + ((x - 0.75) / 0.25) * (1000000 - kneeIncome));
      }
    };
  }
  rebuildMapping(4050);

  function formatIncomeLabel(income) {
    if (income >= 1000000) return (income / 1000000).toFixed(0) + 'M';
    return (income / 1000).toFixed(0) + 'k';
  }

  // ── Generate nice tick incomes based on knee ──
  function generateTickIncomes(knee) {
    const ticks = [0];
    // 6 ticks in the first 75% zone
    for (let i = 1; i <= 6; i++) {
      ticks.push(Math.round((knee / 6) * i));
    }
    // 5 ticks in the last 25% zone
    const after = 1000000 - knee;
    for (let i = 1; i <= 5; i++) {
      ticks.push(knee + Math.round((after / 5) * i));
    }
    return ticks;
  }

  // ── Sweet spot ranges (stored for the plugin) ──
  let sweetSpotRanges = [];

  function computeSweetSpotRanges(grossMinSalary) {
    const cliffs = [
      { income: 12 * grossMinSalary, name: '12× pension' },
      { income: 24 * grossMinSalary, name: '24× pension' },
      { income: 1000000,            name: 'end of chart' }
    ];
    const ranges = [];
    const maxIncome = 1000000;

    cliffs.forEach((cliff, ci) => {
      const lookbackStart = ci === 0 ? 1000 : cliffs[ci - 1].income; // skip income=0
      const cliffIncome = Math.min(cliff.income, maxIncome);
      if (lookbackStart >= cliffIncome) return;

      // Sample effective rates at 500 RON steps
      let minRate = Infinity;
      const samples = [];
      for (let inc = lookbackStart; inc <= cliffIncome; inc += 500) {
        const t = calculateTaxes(grossMinSalary, inc, 0);
        const rate = Math.min(t.effectiveRate, 100);
        samples.push({ income: inc, rate });
        if (rate < minRate) minRate = rate;
      }

      if (minRate === Infinity || samples.length === 0) return;

      const threshold = minRate + 2;

      // Scan backwards from the cliff to find the contiguous band where rate <= threshold
      let rangeStart = null;
      let rangeEnd = null;

      for (let i = samples.length - 1; i >= 0; i--) {
        if (samples[i].rate <= threshold) {
          if (rangeEnd === null) rangeEnd = samples[i].income;
          rangeStart = samples[i].income;
        } else if (rangeEnd !== null) {
          break;
        }
      }

      if (rangeStart !== null && rangeEnd !== null && rangeStart < rangeEnd) {
        ranges.push({
          xStart: incomeToX(rangeStart),
          xEnd: incomeToX(rangeEnd),
          label: cliff.name,
          color: ci === 2
            ? 'rgba(80, 200, 120, 0.12)'
            : 'rgba(80, 200, 120, 0.14)'
        });
      }
    });

    return ranges;
  }

  // ── Sweet spot vertical markers ────
  function getSweetSpotLines(grossMinSalary) {
    const b12 = 12 * grossMinSalary;
    const b24 = 24 * grossMinSalary;
    const b72 = 72 * grossMinSalary;
    return [
      { income: b12, label: '12× pension', color: 'rgba(255,127,80,0.5)' },
      { income: b24, label: '24× pension', color: 'rgba(255,127,80,0.5)' },
      { income: b72, label: '72× CASS cap', color: 'rgba(236,176,99,0.5)' }
    ];
  }

  // ── Overview chart (non-linear x, 0–1M RON) ──
  function buildOverviewChart() {
    const { gms } = validateInputs();
    const grossMinSalary = gms || 4050;
    rebuildMapping(grossMinSalary);

    const maxIncome = 1000000;
    const points = [];

    // Dense sampling below knee, sparser above
    for (let income = 0; income <= kneeIncome; income += 1000) {
      const t = calculateTaxes(grossMinSalary, income, 0);
      points.push({ x: incomeToX(income), y: Math.min(t.effectiveRate, 100) });
    }
    for (let income = kneeIncome + 1000; income <= maxIncome; income += 5000) {
      const t = calculateTaxes(grossMinSalary, income, 0);
      points.push({ x: incomeToX(income), y: Math.min(t.effectiveRate, 100) });
    }

    // Compute sweet spot ranges
    sweetSpotRanges = computeSweetSpotRanges(grossMinSalary);

    const tickIncomes = generateTickIncomes(kneeIncome);
    const ctx = document.getElementById('tc-overview-chart').getContext('2d');

    if (overviewChart) overviewChart.destroy();

    overviewChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Effective Tax Rate (%)',
            data: points,
            borderColor: '#ecb063',
            backgroundColor: 'rgba(236, 176, 99, 0.08)',
            borderWidth: 1.5,
            fill: true,
            pointRadius: 0,
            tension: 0.3,
            parsing: false
          },
          {
            label: 'Your position',
            data: [],
            borderColor: '#ff7f50',
            backgroundColor: '#ff7f50',
            pointRadius: 7,
            pointHoverRadius: 10,
            pointStyle: 'circle',
            showLine: false,
            order: 2,
            parsing: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        layout: {
          padding: { top: 4, bottom: 16 }
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Effective tax rate per income',
            color: '#888',
            font: { family: 'SF-Pro-Display, monospace', size: 13 },
            padding: { bottom: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === 'Your position') {
                  return 'Your rate: ' + fmtPct(ctx.raw.y);
                }
                return fmtPct(ctx.raw.y);
              },
              title: (ctx) => {
                const income = xToIncome(ctx[0].raw.x);
                return 'Income: ' + formatIncomeLabel(income).replace('k', ',000').replace('M', ',000,000') + ' RON';
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 1,
            ticks: {
              color: 'transparent',
              display: true
            },
            grid: { display: false }
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: '#888',
              stepSize: 10,
              callback: (v) => v + '%'
            },
            grid: { color: '#1a1a1a' }
          }
        }
      },
      plugins: [{
        id: 'overviewAnnotations',
        beforeDraw(chart) {
          const { ctx, scales: { x, y } } = chart;

          // ── Draw sweet-spot range bands (behind everything) ──
          sweetSpotRanges.forEach(range => {
            const xLeft  = x.getPixelForValue(range.xStart);
            const xRight = x.getPixelForValue(range.xEnd);
            ctx.save();
            ctx.fillStyle = range.color;
            ctx.fillRect(xLeft, y.top, xRight - xLeft, y.bottom - y.top);
            ctx.restore();
          });

          // ── Draw custom x-axis grid lines (behind data) ──
          const tickIncomes = generateTickIncomes(kneeIncome);
          tickIncomes.forEach(inc => {
            const xPos = x.getPixelForValue(incomeToX(inc));
            if (xPos < x.left || xPos > x.right) return;
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1;
            ctx.moveTo(xPos, y.top);
            ctx.lineTo(xPos, y.bottom);
            ctx.stroke();
            ctx.restore();
          });
        },
        afterDraw(chart) {
          const { ctx, scales: { x, y } } = chart;

          // ── Draw sweet-spot start markers on x-axis ──
          sweetSpotRanges.forEach(range => {
            const xStart = x.getPixelForValue(range.xStart);
            if (xStart < x.left || xStart > x.right) return;

            // Small downward triangle
            ctx.save();
            ctx.fillStyle = 'rgba(80, 200, 120, 0.8)';
            ctx.beginPath();
            ctx.moveTo(xStart - 4, y.bottom);
            ctx.lineTo(xStart + 4, y.bottom);
            ctx.lineTo(xStart, y.bottom + 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Income label below
            const startIncome = xToIncome(range.xStart);
            ctx.save();
            ctx.fillStyle = 'rgba(80, 200, 120, 0.8)';
            ctx.font = '9px SF-Pro-Display, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(formatIncomeLabel(startIncome), xStart, y.bottom + 18);
            ctx.restore();
          });

          // ── Your-position x-axis pin ──
          const { income } = validateInputs();
          const totalIncome = income;
          if (totalIncome > 0 && totalIncome <= 1000000) {
            const youX = x.getPixelForValue(incomeToX(totalIncome));
            if (youX >= x.left && youX <= x.right) {
              // Triangle
              ctx.save();
              ctx.fillStyle = '#ff7f50';
              ctx.beginPath();
              ctx.moveTo(youX - 5, y.bottom);
              ctx.lineTo(youX + 5, y.bottom);
              ctx.lineTo(youX, y.bottom + 7);
              ctx.closePath();
              ctx.fill();
              ctx.restore();

              // Label (with text outline)
              ctx.save();
              ctx.font = 'bold 9px SF-Pro-Display, monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.strokeStyle = '#050505';
              ctx.lineWidth = 2;
              ctx.strokeText(formatIncomeLabel(totalIncome), youX, y.bottom + 18);
              ctx.fillStyle = '#ff7f50';
              ctx.fillText(formatIncomeLabel(totalIncome), youX, y.bottom + 18);
              ctx.restore();
            }
          }

          // ── Draw custom x-axis tick labels ──
          const tickIncomes = generateTickIncomes(kneeIncome);
          tickIncomes.forEach(inc => {
            const xPos = x.getPixelForValue(incomeToX(inc));
            if (xPos < x.left || xPos > x.right) return;
            ctx.save();
            ctx.fillStyle = '#888';
            ctx.font = '10px SF-Pro-Display, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(formatIncomeLabel(inc), xPos, y.bottom + 6);
            ctx.restore();
          });

          // ── Draw sweet-spot vertical marker lines + left/right rate diffs ──
          const { gms } = validateInputs();
          const gmsVal = gms || 4050;
          const spots = getSweetSpotLines(gmsVal);

          spots.forEach(spot => {
            const xPos = x.getPixelForValue(incomeToX(spot.income));
            if (xPos < x.left || xPos > x.right) return;

            // Dashed vertical line
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = spot.color;
            ctx.lineWidth = 1.2;
            ctx.moveTo(xPos, y.top);
            ctx.lineTo(xPos, y.bottom);
            ctx.stroke();
            ctx.restore();

            // Cliff label at top (with text outline)
            ctx.save();
            ctx.font = '9px SF-Pro-Display, monospace';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#050505';
            ctx.lineWidth = 2;
            ctx.strokeText(spot.label, xPos, y.top + 12);
            ctx.fillStyle = spot.color;
            ctx.fillText(spot.label, xPos, y.top + 12);
            ctx.restore();

            // Left / right rate diff (10 RON offset each side)
            const rateLeft  = Math.min(calculateTaxes(gmsVal, Math.max(1, spot.income - 10), 0).effectiveRate, 100);
            const rateRight = Math.min(calculateTaxes(gmsVal, spot.income + 10, 0).effectiveRate, 100);

            ctx.save();
            ctx.font = '9px SF-Pro-Display, monospace';

            // Left side
            ctx.textAlign = 'right';
            ctx.strokeStyle = '#050505';
            ctx.lineWidth = 2;
            ctx.strokeText(rateLeft.toFixed(1) + '%', xPos - 6, y.top + 26);
            ctx.fillStyle = spot.color;
            ctx.fillText(rateLeft.toFixed(1) + '%', xPos - 6, y.top + 26);

            // Right side
            ctx.textAlign = 'left';
            ctx.strokeText(rateRight.toFixed(1) + '%', xPos + 6, y.top + 26);
            ctx.fillText(rateRight.toFixed(1) + '%', xPos + 6, y.top + 26);
            ctx.restore();
          });
        }
      }]
    });
  }

  // ── Update the "you are here" dot on the overview chart ──
  function updateOverviewMarker() {
    if (!overviewChart) return;
    const { gms, income, deduct } = validateInputs();
    const grossMinSalary = gms || 4050;
    rebuildMapping(grossMinSalary);
    const totalIncome    = income;
    const deductible     = deduct;

    // Hide marker when total income is 0
    if (totalIncome <= 0) {
      overviewChart.data.datasets[1].data = [];
      overviewChart.update('none');
      return;
    }

    const t = calculateTaxes(grossMinSalary, totalIncome, deductible);
    const clampedRate = Math.min(t.effectiveRate, 100);

    overviewChart.data.datasets[1].data = [
      { x: incomeToX(Math.min(totalIncome, 1000000)), y: clampedRate }
    ];
    overviewChart.update('none');
  }

  // ── Breakdown chart (doughnut) ──
  function updateBreakdownChart(t, deductibleExpenses) {
    const ctx = document.getElementById('tc-breakdown-chart').getContext('2d');

    if (breakdownChart) breakdownChart.destroy();

    const rawTakeHome = t.takeHome;
    const doughnutTakeHome = Math.max(0, rawTakeHome);
    const total = deductibleExpenses + t.totalTax + doughnutTakeHome;
    const isEmpty = total === 0;
    const hasNegTakeHome = rawTakeHome < 0;

    const dLabels = isEmpty ? ['']
      : hasNegTakeHome
        ? ['Deductible Expenses', 'Healthcare (CASS)', 'Pension (CAS)', 'Income Tax']
        : ['Deductible Expenses', 'Healthcare (CASS)', 'Pension (CAS)', 'Income Tax', 'Take-Home'];
    const dData = isEmpty ? [1]
      : hasNegTakeHome
        ? [deductibleExpenses, t.healthcareTax, t.pensionTax, t.incomeTax]
        : [deductibleExpenses, t.healthcareTax, t.pensionTax, t.incomeTax, doughnutTakeHome];
    const dColors = isEmpty ? ['rgba(255,255,255,0.04)']
      : hasNegTakeHome
        ? [
            'rgba(120, 140, 180, 0.7)',
            'rgba(236, 176, 99, 0.7)',
            'rgba(255, 127, 80, 0.7)',
            'rgba(160, 140, 200, 0.7)'
          ]
        : [
            'rgba(120, 140, 180, 0.7)',
            'rgba(236, 176, 99, 0.7)',
            'rgba(255, 127, 80, 0.7)',
            'rgba(160, 140, 200, 0.7)',
            'rgba(80, 200, 120, 0.7)'
          ];

    breakdownChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: dLabels,
        datasets: [{
          data: dData,
          backgroundColor: dColors,
          borderColor: '#0a0a0a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: !isEmpty,
            position: 'bottom',
            labels: { color: '#e0e0e0', font: { family: 'SF-Pro-Display, monospace', size: 11 }, padding: 16 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0.0';
                return ' ' + ctx.label + ': ' + fmtRON(ctx.raw) + ' (' + pct + '%)';
              }
            }
          }
        }
      },
      plugins: [{
        id: 'doughnutPercentages',
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          const meta = chart.getDatasetMeta(0);
          const sum = data.datasets[0].data.reduce((a, b) => a + b, 0);
          if (sum === 0) return;

          meta.data.forEach((arc, i) => {
            const value = data.datasets[0].data[i];
            const pct = ((value / sum) * 100);
            if (pct < 3) return; // skip tiny slices

            const angle = (arc.startAngle + arc.endAngle) / 2;
            const radius = (arc.outerRadius + arc.innerRadius) / 2;
            const x = arc.x + Math.cos(angle) * radius;
            const y = arc.y + Math.sin(angle) * radius;

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px SF-Pro-Display, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pct.toFixed(1) + '%', x, y);
          });
        }
      }]
    });
  }

  // ── Event listeners ────────────────
  function truncateDecimals(input) {
    const val = input.value;
    const dot = val.indexOf('.');
    if (dot !== -1 && val.length - dot - 1 > 3) {
      input.value = val.slice(0, dot + 4);
    }
  }

  grossMinSalaryInput.addEventListener('input', () => {
    truncateDecimals(grossMinSalaryInput);
    updateCalculator();
    buildOverviewChart();
  });

  totalIncomeInput.addEventListener('input', () => {
    truncateDecimals(totalIncomeInput);
    updateCalculator();
    updateOverviewMarker();
  });

  deductibleInput.addEventListener('input', () => {
    truncateDecimals(deductibleInput);
    updateCalculator();
    updateOverviewMarker();
  });

  // ── Init ───────────────────────────
  buildOverviewChart();      // populates sweetSpotRanges first
  updateCalculator();
  updateOverviewMarker();
});
