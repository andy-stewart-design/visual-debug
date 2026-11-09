import { For, Show, createSignal, onCleanup, onMount } from 'solid-js'
import './App.css'

type GeometryCase = {
  label: string
  canvasWidth: number
  canvasHeight: number
  anchor: { left: number; top: number; width: number; height: number }
  comparison: { left: number; top: number; width: number; height: number }
  expected: string
}

const geometryCases: Record<string, GeometryCase> = {
  horizontal: {
    label: 'Horizontal gap',
    canvasWidth: 360,
    canvasHeight: 150,
    anchor: { left: 0, top: 0, width: 100, height: 100 },
    comparison: { left: 140, top: 0, width: 100, height: 100 },
    expected: 'Horizontal gap: 40 CSS px',
  },
  diagonal: {
    label: 'Diagonal gaps',
    canvasWidth: 360,
    canvasHeight: 280,
    anchor: { left: 0, top: 0, width: 100, height: 100 },
    comparison: { left: 140, top: 160, width: 100, height: 100 },
    expected: 'Horizontal gap: 40 CSS px · vertical gap: 60 CSS px',
  },
  containment: {
    label: 'Containment insets',
    canvasWidth: 260,
    canvasHeight: 240,
    anchor: { left: 0, top: 0, width: 200, height: 200 },
    comparison: { left: 20, top: 30, width: 50, height: 60 },
    expected: 'Inner insets: left 20 · top 30 · right 130 · bottom 110 CSS px',
  },
  overlap: {
    label: 'Partial overlap',
    canvasWidth: 260,
    canvasHeight: 220,
    anchor: { left: 0, top: 0, width: 100, height: 100 },
    comparison: { left: 50, top: 50, width: 100, height: 100 },
    expected: 'Partial overlap · never a negative gap',
  },
  touching: {
    label: 'Touching edges',
    canvasWidth: 260,
    canvasHeight: 150,
    anchor: { left: 0, top: 0, width: 100, height: 100 },
    comparison: { left: 100, top: 0, width: 100, height: 100 },
    expected: 'Horizontal distance: 0 CSS px (shared edge)',
  },
  vertical: {
    label: 'Vertical gap',
    canvasWidth: 240,
    canvasHeight: 280,
    anchor: { left: 0, top: 0, width: 100, height: 100 },
    comparison: { left: 0, top: 140, width: 100, height: 100 },
    expected: 'Vertical gap: 40 CSS px',
  },
}

const initialDynamic = {
  moveOffset: 0,
  targetWidth: 128,
  transformed: false,
  animated: false,
  anchorVisible: true,
  comparisonVisible: true,
  comparisonZeroArea: false,
}

function App() {
  const [geometryKey, setGeometryKey] = createSignal('horizontal')
  const [observedCapture, setObservedCapture] = createSignal(0)
  const [observedBubble, setObservedBubble] = createSignal(0)
  const [linkActivations, setLinkActivations] = createSignal(0)
  const [submissionCount, setSubmissionCount] = createSignal(0)
  const [checkboxChanges, setCheckboxChanges] = createSignal(0)
  const [checkboxChecked, setCheckboxChecked] = createSignal(false)
  const [toggleCount, setToggleCount] = createSignal(0)
  const [toggleOn, setToggleOn] = createSignal(false)
  const [inputValue, setInputValue] = createSignal('')
  const [inputFocused, setInputFocused] = createSignal(false)
  const [dragStarts, setDragStarts] = createSignal(0)
  const [dragOutcome, setDragOutcome] = createSignal('Not dragged yet')
  const [nestedClicks, setNestedClicks] = createSignal(0)
  const [pointerDowns, setPointerDowns] = createSignal(0)
  const [customClicks, setCustomClicks] = createSignal(0)
  const [instrumentationReady, setInstrumentationReady] = createSignal(false)
  const [dynamic, setDynamic] = createSignal(initialDynamic)

  let interactionRoot: HTMLElement | undefined
  let nestedScrollArea: HTMLDivElement | undefined

  const updateDynamic = (change: Partial<typeof initialDynamic>) => {
    setDynamic((state) => ({ ...state, ...change }))
  }

  const resetDynamic = () => {
    setDynamic(initialDynamic)
    nestedScrollArea?.scrollTo({ top: 0, left: 0 })
  }

  const resetAll = () => {
    setGeometryKey('horizontal')
    setObservedCapture(0)
    setObservedBubble(0)
    setLinkActivations(0)
    setSubmissionCount(0)
    setCheckboxChanges(0)
    setCheckboxChecked(false)
    setToggleCount(0)
    setToggleOn(false)
    setInputValue('')
    setInputFocused(false)
    setDragStarts(0)
    setDragOutcome('Not dragged yet')
    setNestedClicks(0)
    setPointerDowns(0)
    setCustomClicks(0)
    resetDynamic()
    window.scrollTo({ top: 0, left: 0 })
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  onMount(() => {
    const observedTarget = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || !interactionRoot?.contains(target)) return
      if (!target.closest('[data-fixture-target]')) return
      setObservedCapture((count) => count + 1)
    }

    const bubbledTarget = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || !interactionRoot?.contains(target)) return
      if (!target.closest('[data-fixture-target]')) return
      setObservedBubble((count) => count + 1)
    }

    // Install the page capture observers before an extension session can be activated.
    // They only report routing observations; they are not part of the page outcomes.
    window.addEventListener('pointerdown', observedTarget, true)
    window.addEventListener('click', observedTarget, true)
    document.addEventListener('pointerdown', bubbledTarget)
    document.addEventListener('click', bubbledTarget)
    setInstrumentationReady(true)

    onCleanup(() => {
      window.removeEventListener('pointerdown', observedTarget, true)
      window.removeEventListener('click', observedTarget, true)
      document.removeEventListener('pointerdown', bubbledTarget)
      document.removeEventListener('click', bubbledTarget)
      setInstrumentationReady(false)
    })
  })

  return (
    <main>
      <header class="page-header">
        <div class="eyebrow">VISUAL DEBUG · STEP 1.2</div>
        <div class="header-row">
          <div>
            <h1>Inspection playground</h1>
            <p class="lede">
              A deterministic page for checking ordinary interactions, CSS geometry, and dynamic layout before inspection is added.
            </p>
          </div>
          <button class="reset-button" type="button" onClick={resetAll}>
            Reset everything
          </button>
        </div>
        <div class="notice">
          <strong>Manual baseline:</strong> use these controls normally first. The page deliberately does not suppress gestures or provide a measurement overlay.
        </div>
      </header>

      <section class="section-card" aria-labelledby="geometry-heading">
        <div class="section-heading">
          <div>
            <div class="section-kicker">01 · FIXED GEOMETRY</div>
            <h2 id="geometry-heading">Border-box measurement cases</h2>
            <p>Select a case, then compare the blank rectangles with the expected CSS-pixel relationship.</p>
          </div>
          <label class="select-label">
            Case
            <select value={geometryKey()} onChange={(event) => setGeometryKey(event.currentTarget.value)}>
              <For each={Object.entries(geometryCases)}>
                {([key, value]) => <option value={key}>{value.label}</option>}
              </For>
            </select>
          </label>
        </div>

        <div class="geometry-layout">
          <div class="geometry-canvas-shell">
            <div
              class="geometry-canvas"
              style={{
                width: `${geometryCases[geometryKey()].canvasWidth}px`,
                height: `${geometryCases[geometryKey()].canvasHeight}px`,
              }}
            >
              <div
                class="geometry-box anchor-box"
                aria-label="Anchor rectangle"
                style={{
                  left: `${geometryCases[geometryKey()].anchor.left}px`,
                  top: `${geometryCases[geometryKey()].anchor.top}px`,
                  width: `${geometryCases[geometryKey()].anchor.width}px`,
                  height: `${geometryCases[geometryKey()].anchor.height}px`,
                }}
              />
              <div
                class="geometry-box comparison-box"
                aria-label="Comparison rectangle"
                style={{
                  left: `${geometryCases[geometryKey()].comparison.left}px`,
                  top: `${geometryCases[geometryKey()].comparison.top}px`,
                  width: `${geometryCases[geometryKey()].comparison.width}px`,
                  height: `${geometryCases[geometryKey()].comparison.height}px`,
                }}
              />
            </div>
          </div>
          <div class="geometry-notes">
            <div class="box-key">
              <span class="key-swatch anchor-swatch" /> Anchor A
              <span class="key-swatch comparison-swatch" /> Comparison B
            </div>
            <p class="expected-label">Expected relationship</p>
            <strong>{geometryCases[geometryKey()].expected}</strong>
            <p class="muted-text">Coordinates are local to the fixed canvas. Every rectangle uses exact CSS <code>border-box</code> dimensions; labels stay outside the measurable boxes.</p>
          </div>
        </div>
      </section>

      <section class="section-card" aria-labelledby="interaction-heading" ref={interactionRoot}>
        <div class="section-heading compact-heading">
          <div>
            <div class="section-kicker">02 · NORMAL INTERACTIONS</div>
            <h2 id="interaction-heading">Controls with visible outcomes</h2>
            <p>Every target has a stable outcome so an accidental activation is easy to spot.</p>
          </div>
          <div class="instrumentation-status" classList={{ ready: instrumentationReady() }}>
            <span class="status-dot" />
            Page handlers {instrumentationReady() ? 'ready' : 'inactive'}
          </div>
        </div>

        <div class="interaction-grid">
          <article class="fixture-panel">
            <div class="panel-title-row">
              <h3>Navigation & form</h3>
              <span class="counter-chip">{linkActivations()} link · {submissionCount()} submit</span>
            </div>
            <p class="panel-help">The link uses only a local hash. Submission is prevented and counted.</p>
            <div class="control-stack">
              <a
                class="fixture-link"
                data-fixture-target="safe-link"
                href="#safe-destination"
                onClick={() => setLinkActivations((count) => count + 1)}
              >
                Go to the local destination <span aria-hidden="true">↗</span>
              </a>
              <form
                class="fixture-form"
                data-fixture-target="submit-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  setSubmissionCount((count) => count + 1)
                }}
              >
                <button data-fixture-target="submit-button" type="submit">Submit safely</button>
                <span class="outcome-text">{submissionCount() ? `Prevented submission #${submissionCount()}` : 'No submission yet'}</span>
              </form>
            </div>
          </article>

          <article class="fixture-panel">
            <div class="panel-title-row">
              <h3>State & focus</h3>
              <span class="counter-chip">{checkboxChanges()} checks · {toggleCount()} toggles</span>
            </div>
            <p class="panel-help">Focus, input, and state changes are independent outcomes.</p>
            <div class="control-stack">
              <label class="check-row" data-fixture-target="checkbox">
                <input
                  type="checkbox"
                  checked={checkboxChecked()}
                  onChange={(event) => {
                    setCheckboxChecked(event.currentTarget.checked)
                    setCheckboxChanges((count) => count + 1)
                  }}
                />
                <span>Checkbox is {checkboxChecked() ? 'on' : 'off'}</span>
              </label>
              <button
                class="toggle-button"
                data-fixture-target="toggle"
                type="button"
                aria-pressed={toggleOn()}
                onClick={() => {
                  setToggleOn((value) => !value)
                  setToggleCount((count) => count + 1)
                }}
              >
                Toggle: {toggleOn() ? 'on' : 'off'}
              </button>
              <label class="field-label" data-fixture-target="text-input">
                <span>Focus and type</span>
                <input
                  value={inputValue()}
                  placeholder="Try focusing this field"
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onInput={(event) => setInputValue(event.currentTarget.value)}
                />
              </label>
              <span class="outcome-text">{inputFocused() ? 'Input has focus' : 'Input is not focused'} · {inputValue() ? `Value: “${inputValue()}”` : 'No value'}</span>
            </div>
          </article>

          <article class="fixture-panel">
            <div class="panel-title-row">
              <h3>Pointer & nested targets</h3>
              <span class="counter-chip">{pointerDowns()} down · {customClicks()} click</span>
            </div>
            <p class="panel-help">The first control records pointer-down separately from its click. The second has nested text.</p>
            <div class="control-stack">
              <button
                class="pointer-button"
                data-fixture-target="pointer-control"
                type="button"
                onPointerDown={() => setPointerDowns((count) => count + 1)}
                onClick={() => setCustomClicks((count) => count + 1)}
              >
                Pointer-down control
              </button>
              <button
                class="nested-button"
                data-fixture-target="nested-button"
                type="button"
                onClick={() => setNestedClicks((count) => count + 1)}
              >
                <span>Nested button text</span> <span class="nested-icon" aria-hidden="true">●</span>
              </button>
              <span class="outcome-text">Nested button activations: {nestedClicks()}</span>
            </div>
          </article>

          <article class="fixture-panel">
            <div class="panel-title-row">
              <h3>Drag outcome</h3>
              <span class="counter-chip">{dragStarts()} starts</span>
            </div>
            <p class="panel-help">Drag this element normally. It reports drag-start without changing the page.</p>
            <div
              class="drag-target"
              data-fixture-target="draggable"
              draggable="true"
              onDragStart={(event) => {
                event.dataTransfer?.setData('text/plain', 'playground-drag')
                setDragStarts((count) => count + 1)
                setDragOutcome('Drag started')
              }}
              onDragEnd={() => setDragOutcome('Drag ended')}
            >
              <span class="drag-grip" aria-hidden="true">⠿</span>
              Drag me
            </div>
            <span class="outcome-text">{dragOutcome()}</span>
          </article>
        </div>

        <div class="telemetry-row">
          <div>
            <strong>Observed page events</strong>
            <span>Capture and bubble listeners watch only marked fixture targets.</span>
          </div>
          <div class="telemetry-values">
            <span>capture <b>{observedCapture()}</b></span>
            <span>bubble <b>{observedBubble()}</b></span>
          </div>
          <button class="small-button" type="button" onClick={() => { setObservedCapture(0); setObservedBubble(0) }}>
            Reset event counts
          </button>
        </div>
      </section>

      <section class="section-card" aria-labelledby="dynamic-heading">
        <div class="section-heading compact-heading">
          <div>
            <div class="section-kicker">03 · DYNAMIC GEOMETRY</div>
            <h2 id="dynamic-heading">Scroll, move, resize, and invalidate</h2>
            <p>These targets change in place. Controls are outside the scrollable target area.</p>
          </div>
          <button class="small-button" type="button" onClick={resetDynamic}>Reset dynamic case</button>
        </div>

        <div class="dynamic-controls" aria-label="Dynamic geometry controls">
          <button class="small-button" type="button" onClick={() => updateDynamic({ moveOffset: dynamic().moveOffset ? 0 : 48 })}>
            Move comparison
          </button>
          <button class="small-button" type="button" onClick={() => updateDynamic({ targetWidth: dynamic().targetWidth === 128 ? 188 : 128 })}>
            Resize comparison
          </button>
          <button class="small-button" type="button" onClick={() => updateDynamic({ transformed: !dynamic().transformed })}>
            CSS transform: {dynamic().transformed ? 'on' : 'off'}
          </button>
          <button class="small-button" type="button" onClick={() => updateDynamic({ animated: !dynamic().animated })}>
            Animation: {dynamic().animated ? 'on' : 'off'}
          </button>
          <button class="small-button" type="button" onClick={() => nestedScrollArea?.scrollTo({ top: 150, behavior: 'smooth' })}>
            Scroll nested area
          </button>
          <button class="small-button" type="button" onClick={() => window.scrollTo({ top: Math.min(document.body.scrollHeight, window.scrollY + 260), behavior: 'smooth' })}>
            Scroll page
          </button>
          <button class="small-button warning-button" type="button" onClick={() => updateDynamic({ anchorVisible: !dynamic().anchorVisible })}>
            {dynamic().anchorVisible ? 'Remove anchor' : 'Restore anchor'}
          </button>
          <button class="small-button warning-button" type="button" onClick={() => updateDynamic({ comparisonVisible: !dynamic().comparisonVisible })}>
            {dynamic().comparisonVisible ? 'Hide comparison' : 'Show comparison'}
          </button>
          <button class="small-button warning-button" type="button" onClick={() => updateDynamic({ comparisonZeroArea: !dynamic().comparisonZeroArea })}>
            Zero area: {dynamic().comparisonZeroArea ? 'on' : 'off'}
          </button>
        </div>

        <div class="dynamic-readout">
          <span>Anchor: <b>{dynamic().anchorVisible ? 'present' : 'removed'}</b></span>
          <span>Comparison: <b>{dynamic().comparisonVisible ? (dynamic().comparisonZeroArea ? 'zero-area' : 'present') : 'hidden'}</b></span>
          <span>Offset: <b>{dynamic().moveOffset}px</b></span>
          <span>Width: <b>{dynamic().targetWidth}px</b></span>
        </div>

        <div class="nested-scroll" ref={nestedScrollArea}>
          <div class="scroll-content">
            <div class="scroll-marker marker-top">Nested scroll start</div>
            <Show when={dynamic().anchorVisible}>
              <div class="dynamic-target dynamic-anchor" aria-label="Dynamic anchor target">
                Anchor target
              </div>
            </Show>
            <Show when={dynamic().comparisonVisible}>
              <div
                class="dynamic-target dynamic-comparison"
                classList={{
                  'is-transformed': dynamic().transformed,
                  'is-animated': dynamic().animated,
                  'is-zero-area': dynamic().comparisonZeroArea,
                }}
                style={{
                  width: `${dynamic().targetWidth}px`,
                  '--move-x': `${dynamic().moveOffset}px`,
                }}
                aria-label="Dynamic comparison target"
              >
                Comparison target
              </div>
            </Show>
            <div class="scroll-marker marker-bottom">Nested scroll end · use the controls above to return to reset</div>
          </div>
        </div>
      </section>

      <section class="destination" id="safe-destination" aria-labelledby="destination-heading">
        <div class="section-kicker">LOCAL HASH DESTINATION</div>
        <h2 id="destination-heading">Safe destination reached</h2>
        <p>The link above stays inside this page. Reset everything returns the page to the top and clears its hash.</p>
      </section>

      <footer class="page-footer">
        <span>Fixture state is local to this tab.</span>
        <span>Manual smoke pending: normal actions, counters, resets, scroll, and dynamic cases in Chrome.</span>
      </footer>
    </main>
  )
}

export default App
