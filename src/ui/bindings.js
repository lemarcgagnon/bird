// src/ui/bindings.js
// Factorise les patterns de binding DOM ↔ store :
//   - bindSlider  : range + champ numérique éditable → store.setState
//   - bindToggleBar : groupe de boutons segmentés → store.setState
//   - bindCheckbox : case à cocher → store.setState
//
// Chaque fonction prend l'ID DOM et un `write(value)` qui effectue le patch de state.
// L'UI ne connaît PAS la forme du state — elle reçoit juste un callback.

const $ = (id) => document.getElementById(id);

/**
 * Slider numérique avec champ éditable synchronisé.
 * @param {string} id - ID du .slider-group
 * @param {number} initial - valeur initiale
 * @param {object} opts - { unit, dec, allowOverflow, onChange(v) }
 */
export function bindSlider(id, initial, opts) {
  const { unit = '', dec = 0, allowOverflow = false, onChange } = opts;
  const sg = $(id);
  if (!sg) return null;
  const range = sg.querySelector('input[type=range]');
  const valSpan = sg.querySelector('.slider-val');

  const numInp = document.createElement('input');
  numInp.type = 'number';
  numInp.className = 'num-input';
  numInp.value = Number(initial).toFixed(dec);
  numInp.min = range.min;
  numInp.max = range.max;
  numInp.step = range.step;

  const unitSpan = document.createElement('span');
  unitSpan.className = 'slider-unit';
  unitSpan.textContent = unit;

  valSpan.textContent = '';
  valSpan.appendChild(numInp);
  valSpan.appendChild(unitSpan);

  // aria-label depuis le texte du label visible — accessible sans modifier la structure HTML
  const labelEl = sg.querySelector('.slider-row span:first-child');
  if (labelEl) range.setAttribute('aria-label', labelEl.textContent.trim());

  range.value = initial;

  range.addEventListener('input', () => {
    const v = parseFloat(range.value);
    numInp.value = v.toFixed(dec);
    onChange(v);
  });

  const applyNum = () => {
    let v = parseFloat(numInp.value);
    if (isNaN(v)) v = parseFloat(range.value);
    const rMin = parseFloat(range.min);
    const rMax = parseFloat(range.max);
    // FIX bug #3 : on clampe la saisie texte au max du slider par défaut.
    // allowOverflow=true n'est activé que sur les dimensions principales où
    // l'utilisateur peut vouloir dépasser le slider. Dans ce cas, le slider
    // se fige à son max mais le numInp reflète la vraie valeur.
    const upperBound = allowOverflow ? rMax * 2 : rMax;
    v = Math.max(rMin, Math.min(upperBound, v));
    range.value = Math.min(v, rMax);
    numInp.value = v.toFixed(dec);
    onChange(v);
  };
  numInp.addEventListener('change', applyNum);
  numInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applyNum(); numInp.blur(); }
  });

  // Handle pour refresh externe (ex: changement de deco active)
  return {
    setValue(v) {
      range.value = Math.min(v, parseFloat(range.max));
      numInp.value = Number(v).toFixed(dec);
    },
  };
}

/**
 * Barre de boutons segmentés (un seul actif à la fois).
 * @param {string} containerId - ID du conteneur (.toggle-bar ou .mode-bar)
 * @param {string} btnSelector - sélecteur des boutons (ex: '.toggle-btn', '.mode-btn')
 * @param {string} initial - valeur initiale (data-val)
 * @param {function} onChange(value)
 */
export function bindToggleBar(containerId, btnSelector, initial, onChange) {
  const container = $(containerId);
  if (!container) return null;
  const btns = container.querySelectorAll(btnSelector);
  const update = (val) => {
    btns.forEach(b => {
      b.classList.toggle('active', b.dataset.val === val);
      b.setAttribute('aria-checked', String(b.dataset.val === val));
    });
  };
  update(initial);
  btns.forEach(b => {
    b.addEventListener('click', () => {
      if (b.classList.contains('disabled')) return;
      update(b.dataset.val);
      onChange(b.dataset.val);
    });
  });
  return { setValue: update };
}

/**
 * Checkbox avec callback et mise à jour visuelle d'un label parent.
 * @param {string} id - ID de l'input[type=checkbox]
 * @param {boolean} initial
 * @param {object} opts - { activeClass, labelEl, onChange(checked) }
 */
export function bindCheckbox(id, initial, opts) {
  const { activeClass = 'on', labelEl, onChange } = opts;
  const cb = $(id);
  if (!cb) return null;
  cb.checked = initial;
  const label = labelEl || cb.parentElement;
  if (label && activeClass) label.classList.toggle(activeClass, initial);
  cb.addEventListener('change', () => {
    if (label && activeClass) label.classList.toggle(activeClass, cb.checked);
    onChange(cb.checked);
  });
  return {
    setValue(v) {
      cb.checked = v;
      if (label && activeClass) label.classList.toggle(activeClass, v);
    },
  };
}
