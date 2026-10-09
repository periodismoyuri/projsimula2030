/* ========================================
   Simula2030 — Pure JS App
   Reads dados-simula2030.json, no deps
   ======================================== */

// ── State ──────────────────────────────────
let DATA = null;
let salary = 0;
let currentScreen = 0;
let prevScreen = 0;

// ── Formatters ─────────────────────────────
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtBRL2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + '%';
const fmtSigned = (v) => (v > 0 ? '+' : '') + fmtBRL.format(v);
const fmtSignedPct = (v) => (v > 0 ? '+' : '') + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + '%';

function fmtCurrency(v) { return fmtBRL.format(v); }

// ── Calculations ───────────────────────────
function projectValue(value, annualRate, years) {
  return value * Math.pow(1 + annualRate / 100, years);
}

function toRealValue(futureValue, accumulatedInflation) {
  return futureValue / (1 + accumulatedInflation / 100);
}

function realChange(nominalPct, inflationPct) {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

function runSimulation() {
  const calc = DATA.calculados;
  const lulaHyp = calc.projecoes.cenarioLula;
  const bolsHyp = calc.projecoes.cenarioBolsonaro;
  const years = calc.projecoes.anosProjecao;

  // Get latest cesta for selected city (use São Paulo as default)
  const cestaSeries = DATA.cestaBasica.serie;
  const latestCesta = cestaSeries[cestaSeries.length - 1];
  const cestaValue = latestCesta.valor;

  // Lula scenario
  const lulaNominal = projectValue(salary, lulaHyp.crescimentoNominalAnual, years);
  const lulaInflAcc = (Math.pow(1 + lulaHyp.inflacaoGeralAnual / 100, years) - 1) * 100;
  const lulaReal = toRealValue(lulaNominal, lulaInflAcc);
  const lulaRealChg = realChange((lulaNominal / salary - 1) * 100, lulaInflAcc);
  const lulaFoodInflAcc = (Math.pow(1 + 3.46 / 100, years) - 1) * 100;
  const lulaCesta = projectValue(cestaValue, 3.46, years);
  const lulaCestaPct = (lulaCesta / lulaNominal) * 100;

  // Bolsonaro scenario
  const bolsNominal = projectValue(salary, bolsHyp.crescimentoNominalAnual, years);
  const bolsInflAcc = (Math.pow(1 + bolsHyp.inflacaoGeralAnual / 100, years) - 1) * 100;
  const bolsReal = toRealValue(bolsNominal, bolsInflAcc);
  const bolsRealChg = realChange((bolsNominal / salary - 1) * 100, bolsInflAcc);
  const bolsFoodInflAcc = (Math.pow(1 + 10.11 / 100, years) - 1) * 100;
  const bolsCesta = projectValue(cestaValue, 10.11, years);
  const bolsCestaPct = (bolsCesta / bolsNominal) * 100;

  return {
    lula: { nominal: lulaNominal, real: lulaReal, realChange: lulaRealChg, inflation: lulaInflAcc, cesta: lulaCesta, cestaPct: lulaCestaPct },
    bolsonaro: { nominal: bolsNominal, real: bolsReal, realChange: bolsRealChg, inflation: bolsInflAcc, cesta: bolsCesta, cestaPct: bolsCestaPct },
    diff: {
      real: lulaReal - bolsReal,
      purchasingPower: lulaReal - bolsReal,
      cestaValue: lulaCesta - bolsCesta,
      cestaPct: lulaCestaPct - bolsCestaPct
    },
    cestaRef: latestCesta,
    cestaInitial: cestaValue
  };
}

// ── Navigation ─────────────────────────────
function goTo(n) {
  if (n > 0 && n < 9 && salary <= 0) return;
  prevScreen = currentScreen;
  currentScreen = n;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  goTo(prevScreen > 0 && prevScreen < 9 ? prevScreen : 0);
}

function isInputFocused() {
  const tag = (document.activeElement?.tagName ?? '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

// ── Render Engine ──────────────────────────
function render() {
  // Show/hide screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`[data-screen="${currentScreen}"]`);
  if (target) target.classList.add('active');

  // Progress bar
  const progWrap = document.getElementById('progress-wrap');
  if (currentScreen >= 1 && currentScreen <= 8) {
    progWrap.style.display = 'flex';
    document.getElementById('progress-fill').style.width = (currentScreen / 8 * 100) + '%';
    document.getElementById('progress-label').textContent = currentScreen + '/8';
  } else {
    progWrap.style.display = 'none';
  }

  // Render screen content
  if (salary > 0 && currentScreen >= 1 && currentScreen <= 8) {
    const sim = runSimulation();
    switch (currentScreen) {
      case 1: renderScreen1(sim); break;
      case 2: renderScreen2(sim); break;
      case 3: renderScreen3(sim); break;
      case 4: renderScreen4(sim); break;
      case 5: renderScreen5(sim); break;
      case 6: renderScreen6(sim); break;
      case 7: renderScreen7(sim); break;
      case 8: renderScreen8(sim); break;
    }
  }
  if (currentScreen === 9) renderMethodology();
}

// ── Screen Renderers ───────────────────────

function statCard(label, value, color, subtitle) {
  return `<div class="stat-card"><div class="label">${label}</div><div class="value ${color ? 'text-' + color : ''}">${value}</div>${subtitle ? '<div class="subtitle">' + subtitle + '</div>' : ''}</div>`;
}

function compBar(label, lulaVal, bolsVal, fmtFn) {
  const maxVal = Math.max(Math.abs(lulaVal), Math.abs(bolsVal)) || 1;
  const lulaW = Math.min(Math.abs(lulaVal) / maxVal * 100, 100);
  const bolsW = Math.min(Math.abs(bolsVal) / maxVal * 100, 100);
  return `
    <div class="comparison">
      <div class="comp-label">${label}</div>
      <div class="comp-row">
        <span class="comp-name text-lime">Lula</span>
        <div class="comp-bar-track"><div class="comp-bar-fill lime" style="width:${Math.max(lulaW, 15)}%">${fmtFn(lulaVal)}</div></div>
      </div>
      <div class="comp-row">
        <span class="comp-name text-coral">Bolsonaro</span>
        <div class="comp-bar-track"><div class="comp-bar-fill coral" style="width:${Math.max(bolsW, 15)}%">${fmtFn(bolsVal)}</div></div>
      </div>
    </div>`;
}

function renderScreen1(sim) {
  const SM = 1621;
  const minWageCount = salary / SM;
  document.getElementById('s1-subtitle').innerHTML = `Hoje, você ganha <span class="text-lime font-bold">${fmtCurrency(salary)}</span> por mês.`;
  document.getElementById('s1-big').innerHTML = `<span class="prefix">R$</span>${fmtCurrency(salary).replace('R$\u00a0', '').replace('R$', '')}`;
  document.getElementById('s1-cards').innerHTML =
    statCard('Salário anual', fmtCurrency(salary * 12), 'white', '12 meses') +
    statCard('Salários mínimos', new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(minWageCount) + 'x', 'white', `Referência: ${fmtCurrency(SM)}`) +
    statCard('Salário mínimo 2026', fmtCurrency(SM), 'lime', 'Decreto 12.797/2025');
}

function renderScreen2(sim) {
  document.getElementById('s2-big').innerHTML = `<span class="prefix">R$</span>${fmtCurrency(sim.lula.nominal).replace('R$\u00a0', '').replace('R$', '')}`;
  document.getElementById('s2-cards').innerHTML =
    statCard('Variação nominal', fmtPct((sim.lula.nominal / salary - 1) * 100), 'lime') +
    statCard('Salário real (R$ de 2026)', fmtCurrency(sim.lula.real), 'white') +
    statCard('Inflação acumulada', fmtPct(sim.lula.inflation), 'white');
}

function renderScreen3(sim) {
  const hs = DATA.calculados;
  document.getElementById('s3-big').innerHTML = `<span class="prefix">R$</span>${fmtCurrency(sim.bolsonaro.nominal).replace('R$\u00a0', '').replace('R$', '')}`;
  document.getElementById('s3-cards').innerHTML =
    statCard('Variação nominal', fmtPct((sim.bolsonaro.nominal / salary - 1) * 100), 'coral') +
    statCard('Salário real (R$ de 2026)', fmtCurrency(sim.bolsonaro.real), 'white') +
    statCard('Inflação acumulada', fmtPct(sim.bolsonaro.inflation), 'white');
  document.getElementById('s3-compare').innerHTML =
    statCard('Lula — salário real', fmtCurrency(sim.lula.real), 'lime') +
    statCard('Bolsonaro — salário real', fmtCurrency(sim.bolsonaro.real), 'coral');
  document.getElementById('s3-explanation').textContent =
    `Durante o governo Bolsonaro, o salário mínimo teve reajuste nominal de ${fmtPct(hs.periodoBolsonaro.salarioMinimo.variacaoNominal)}, mas a inflação foi de ${fmtPct(hs.periodoBolsonaro.inflacaoGeral.acumulada)}, resultando em variação real de ${fmtSignedPct(hs.periodoBolsonaro.salarioMinimoReal.variacaoReal)}.`;
}

function renderScreen4(sim) {
  document.getElementById('s4-comparisons').innerHTML =
    compBar('Salário real em 2030 (em R$ de 2026)', sim.lula.real, sim.bolsonaro.real, fmtCurrency) +
    '<div style="height:1rem"></div>' +
    compBar('Variação real da renda', sim.lula.realChange, sim.bolsonaro.realChange, fmtSignedPct);
  const diff = sim.diff.purchasingPower;
  const color = diff >= 0 ? 'lime' : 'coral';
  const msg = diff >= 0
    ? 'No cenário Lula, você teria mais poder de compra por mês'
    : 'No cenário Bolsonaro, você teria menos poder de compra por mês';
  document.getElementById('s4-diff-card').innerHTML =
    statCard('Diferença mensal de poder de compra', fmtSigned(diff), color, msg);
}

function renderScreen5(sim) {
  const ref = sim.cestaRef;
  document.getElementById('s5-reference').innerHTML =
    statCard(`Referência atual — ${DATA.cestaBasica.cidade}`, fmtCurrency(ref.valor), 'white', `Dados de ${ref.data}`);
  document.getElementById('s5-values').innerHTML =
    statCard('Cesta básica — Lula', fmtCurrency(sim.lula.cesta), 'lime', fmtPct(sim.lula.cestaPct) + ' do salário') +
    statCard('Cesta básica — Bolsonaro', fmtCurrency(sim.bolsonaro.cesta), 'coral', fmtPct(sim.bolsonaro.cestaPct) + ' do salário');
  document.getElementById('s5-comparison').innerHTML =
    compBar('Cesta básica projetada (2030)', sim.lula.cesta, sim.bolsonaro.cesta, fmtCurrency);
  document.getElementById('s5-source').innerHTML =
    `DIEESE — Pesquisa Nacional da Cesta Básica de Alimentos. Cidade: ${DATA.cestaBasica.cidade}. <a href="https://www.dieese.org.br/cesta/" target="_blank">Portal DIEESE</a>`;
}

function renderScreen6(sim) {
  const hs = DATA.calculados;
  const bp = hs.periodoBolsonaro;
  const lp = hs.periodoLula;

  const categories = [
    { name: 'IPCA geral', bolsonaro: bp.inflacaoGeral.acumulada, lula: lp.inflacaoGeral.acumulada },
    { name: 'Alim. e bebidas', bolsonaro: 22.1, lula: 5.8 },
    { name: 'Alim. domicílio', bolsonaro: 25.3, lula: 4.2 },
    { name: 'Carnes', bolsonaro: 18.7, lula: -5.2 },
  ];

  const maxVal = Math.max(...categories.flatMap(c => [Math.abs(c.bolsonaro), Math.abs(c.lula)])) || 1;

  let html = '<div class="chart-bars">';
  for (const cat of categories) {
    const bW = Math.max(Math.abs(cat.bolsonaro) / maxVal * 100, 10);
    const lW = Math.max(Math.abs(cat.lula) / maxVal * 100, 10);
    html += `
      <div class="chart-item">
        <div class="chart-label">${cat.name}</div>
        <div class="chart-pair">
          <div class="chart-bar-row">
            <span class="chart-bar-name text-coral">Bols.</span>
            <div class="chart-bar-track"><div class="chart-bar-fill coral" style="width:${bW}%">${fmtSignedPct(cat.bolsonaro)}</div></div>
          </div>
          <div class="chart-bar-row">
            <span class="chart-bar-name text-lime">Lula</span>
            <div class="chart-bar-track"><div class="chart-bar-fill lime" style="width:${lW}%">${fmtSignedPct(cat.lula)}</div></div>
          </div>
        </div>
      </div>`;
  }
  html += '</div>';
  document.getElementById('s6-chart').innerHTML = html;
}

function renderScreen7(sim) {
  const currentPct = (sim.cestaInitial / salary) * 100;
  document.getElementById('s7-comparison').innerHTML =
    compBar('% do salário com cesta básica em 2030', sim.lula.cestaPct, sim.bolsonaro.cestaPct, v => fmtPct(v));
  document.getElementById('s7-cards').innerHTML =
    statCard('Lula 2030', fmtPct(sim.lula.cestaPct), 'lime') +
    statCard('Bolsonaro 2030', fmtPct(sim.bolsonaro.cestaPct), 'coral') +
    statCard('Hoje (referência)', fmtPct(currentPct), 'white', fmtCurrency(sim.cestaInitial) + ' / ' + fmtCurrency(salary));
}

function renderScreen8(sim) {
  const col = (title, color, d) => `
    <div>
      <div class="column-header">
        <div class="column-dot" style="background:var(--${color})"></div>
        <span class="column-title text-${color}">${title}</span>
      </div>
      ${statCard('Salário nominal', fmtCurrency(d.nominal), color)}
      <div style="height:0.5rem"></div>
      ${statCard('Salário real (R$ de 2026)', fmtCurrency(d.real), color)}
      <div style="height:0.5rem"></div>
      ${statCard('Inflação acumulada', fmtPct(d.inflation), 'white')}
      <div style="height:0.5rem"></div>
      ${statCard('Cesta básica', fmtCurrency(d.cesta), 'white')}
      <div style="height:0.5rem"></div>
      ${statCard('% salário com cesta', fmtPct(d.cestaPct), color)}
    </div>`;

  document.getElementById('s8-columns').innerHTML =
    col('Cenário Lula', 'lime', sim.lula) +
    col('Cenário Bolsonaro', 'coral', sim.bolsonaro);

  const diffColor = sim.diff.real >= 0 ? 'lime' : 'coral';
  document.getElementById('s8-diff').innerHTML = `
    <h3 style="margin-bottom:0.75rem;">Diferença entre cenários</h3>
    <div class="grid-3">
      ${statCard('Salário real', fmtSigned(sim.diff.real), diffColor, 'Diferença mensal em R$ de 2026')}
      ${statCard('Poder de compra', fmtSigned(sim.diff.purchasingPower), diffColor, 'Diferença mensal')}
      ${statCard('Cesta básica', fmtSigned(sim.diff.cestaValue), sim.diff.cestaValue <= 0 ? 'lime' : 'coral', 'Diferença no valor')}
    </div>`;
}

// ── Methodology ────────────────────────────
function renderMethodology() {
  const calc = DATA.calculados;
  const la = calc.projecoes.cenarioLula;
  const ba = calc.projecoes.cenarioBolsonaro;

  const sections = [
    { n: 1, title: 'Sobre esta simulação', body: 'O Simula2030 é uma ferramenta educativa. Não é uma previsão eleitoral nem uma promessa de resultados futuros. Os cenários são condicionais e baseados em dados históricos e hipóteses explícitas.' },
    { n: 2, title: 'Dados históricos', body: 'Os valores do salário mínimo são oficiais e verificados junto à legislação federal (Decretos e MPs publicados no DOU). Os índices de inflação (IPCA) são publicados mensalmente pelo IBGE. Os preços da cesta básica vêm da Pesquisa Nacional da Cesta Básica de Alimentos do DIEESE.' },
    { n: 3, title: 'Como a inflação é aplicada', body: 'A inflação é calculada de forma acumulada (composta), não somando taxas mensais. Para projetar valores futuros, usamos taxas anuais equivalentes derivadas das taxas acumuladas observadas em cada período de governo.' },
    { n: 4, title: 'Como o ganho real é calculado', body: 'O ganho real é a diferença entre o crescimento nominal do salário e a inflação. Fórmula: <code>ganho real = (1 + variação nominal) / (1 + inflação) − 1</code>. Um salário que cresce 10% com inflação de 8% tem ganho real de aproximadamente 1,85%, não 2%.' },
    { n: 5, title: 'Por que seu salário pode não acompanhar o mínimo', body: 'A política de valorização do salário mínimo aplica-se diretamente ao piso nacional. Salários acima do mínimo são negociados individualmente ou por acordos coletivos. O mínimo serve como referência, mas não é um reajuste automático para todos.' },
    { n: 6, title: 'Por que a cesta básica varia entre cidades', body: 'O custo da cesta básica varia entre capitais brasileiras devido a diferenças em custos de transporte, impostos estaduais, oferta local e hábitos de consumo.' },
    { n: 7, title: 'Por que a comparação não prova causalidade', body: 'A economia é influenciada por muitos fatores além do governo federal: cenário internacional, pandemia, câmbio, políticas monetárias do Banco Central, decisões do Congresso e eventos climáticos. Atribuir toda a variação de preços a um presidente é uma simplificação.' },
    { n: 8, title: 'Limitações da projeção até 2030', body: 'Projetar 4 anos à frente envolve incertezas significativas. As taxas de inflação, crescimento econômico e políticas públicas podem mudar substancialmente. Esta simulação assume a repetição de padrões históricos, o que é uma simplificação deliberada para fins educativos.' },
    { n: 9, title: 'Hipóteses utilizadas', body: `
      <p style="margin-bottom:0.5rem;">Taxas anuais derivadas dos indicadores observados. Valores para 2026–2030 são hipotéticos.</p>
      <div class="assumptions-grid">
        <div class="assumption-card">
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--lime)"></div>
            <span class="font-bold text-lime">${la.rotulo}</span>
          </div>
          <p style="font-size:0.75rem;color:var(--gray);margin:0.25rem 0;">${la.descricao}</p>
          <ul>
            <li>Crescimento nominal anual: <span>${fmtPct(la.crescimentoNominalAnual)}</span></li>
            <li>Inflação geral anual: <span>${fmtPct(la.inflacaoGeralAnual)}</span></li>
            <li>Crescimento real anual: <span>${fmtPct(la.crescimentoRealAnual)}</span></li>
          </ul>
        </div>
        <div class="assumption-card">
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--coral)"></div>
            <span class="font-bold text-coral">${ba.rotulo}</span>
          </div>
          <p style="font-size:0.75rem;color:var(--gray);margin:0.25rem 0;">${ba.descricao}</p>
          <ul>
            <li>Crescimento nominal anual: <span>${fmtPct(ba.crescimentoNominalAnual)}</span></li>
            <li>Inflação geral anual: <span>${fmtPct(ba.inflacaoGeralAnual)}</span></li>
            <li>Crescimento real anual: <span>${fmtPct(ba.crescimentoRealAnual)}</span></li>
          </ul>
        </div>
      </div>` },
    { n: 10, title: 'Fontes', body: `<ul style="list-style:none;">
      <li><a href="https://sidra.ibge.gov.br/tabela/7060" target="_blank">IBGE — IPCA (SIDRA tabela 7060)</a></li>
      <li><a href="https://sidra.ibge.gov.br/tabela/4099" target="_blank">IBGE — PNAD Contínua (SIDRA tabela 4099)</a></li>
      <li><a href="https://www.dieese.org.br/cesta/" target="_blank">DIEESE — Cesta Básica de Alimentos</a></li>
      <li><a href="https://www.dieese.org.br/analisecestabasica/salarioMinimo.html" target="_blank">DIEESE — Salário Mínimo Necessário</a></li>
      <li><a href="https://www.planalto.gov.br" target="_blank">Planalto.gov.br — Decretos e MPs do salário mínimo</a></li>
    </ul>` },
    { n: 11, title: 'Indicadores futuros', body: 'Em uma próxima versão, pretendemos incorporar indicadores adicionais como desemprego, renda média, informalidade, Selic, endividamento, PIB, custo de habitação e transporte.' }
  ];

  document.getElementById('methodology-sections').innerHTML = sections.map(s => `
    <div class="method-section anim-fade-up">
      <div class="method-title"><span class="method-num">${s.n}</span>${s.title}</div>
      <div class="method-body">${s.body}</div>
    </div>`).join('');
}

// ── Share ──────────────────────────────────
function shareResult() {
  const sim = runSimulation();
  const text = `Simulei meu salário até 2030 no Simula2030.\nNo cenário Lula: ${fmtCurrency(sim.lula.real)} (real).\nNo cenário Bolsonaro: ${fmtCurrency(sim.bolsonaro.real)} (real).\nDiferença: ${fmtSigned(sim.diff.real)} por mês.`;

  const btn = document.getElementById('share-btn');

  if (navigator.share) {
    navigator.share({ title: 'Simula2030 — Resultado', text }).then(() => {
      btn.textContent = 'COMPARTILHADO!';
      setTimeout(() => btn.textContent = 'COMPARTILHAR RESULTADO', 3000);
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = 'COPIADO!';
      setTimeout(() => btn.textContent = 'COMPARTILHAR RESULTADO', 3000);
    }).catch(() => {
      btn.textContent = 'ERRO AO COPIAR';
      setTimeout(() => btn.textContent = 'COMPARTILHAR RESULTADO', 3000);
    });
  }
}

// ── Currency Input ─────────────────────────
function setupCurrencyInput() {
  const input = document.getElementById('salary-input');
  const submitBtn = document.getElementById('submit-btn');
  const form = document.getElementById('salary-form');

  input.addEventListener('input', () => {
    let digits = input.value.replace(/\D/g, '');
    digits = digits.replace(/^0+/, '') || '';
    if (!digits) { input.value = ''; submitBtn.disabled = true; salary = 0; return; }
    const num = parseInt(digits, 10) / 100;
    input.value = fmtBRL2.format(num);
    salary = num;
    submitBtn.disabled = salary <= 0;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (salary > 0) goTo(1);
  });

  // Preset buttons
  const presets = [1621, 2500, 4000, 7000];
  const presetsEl = document.getElementById('presets');
  presetsEl.innerHTML = presets.map(v =>
    `<button type="button" class="preset-btn" data-value="${v}">${fmtBRL.format(v)}</button>`
  ).join('');
  presetsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    const val = parseInt(btn.dataset.value, 10);
    salary = val;
    input.value = fmtBRL2.format(val);
    submitBtn.disabled = false;
  });
}

// ── Keyboard Navigation ────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (isInputFocused()) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentScreen + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentScreen - 1); }
  });
}

// ── Touch Navigation ───────────────────────
function setupTouch() {
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 60) {
      if (diff < 0) goTo(currentScreen + 1);
      else goTo(currentScreen - 1);
    }
  }, { passive: true });
}

// ── Init ───────────────────────────────────
async function init() {
  try {
    const res = await fetch('dados-simula2030.json');
    DATA = await res.json();
  } catch (err) {
    document.body.innerHTML = '<div style="color:#ff6b6b;padding:2rem;font-family:monospace;">Erro ao carregar dados-simula2030.json. Inicie um servidor local (ex: python -m http.server).</div>';
    return;
  }

  setupCurrencyInput();
  setupKeyboard();
  setupTouch();
  render();
}

init();
