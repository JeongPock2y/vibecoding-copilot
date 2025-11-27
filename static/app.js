document.addEventListener('DOMContentLoaded', () => {
  const modalEl = document.getElementById('todoModal')
  const bsModal = new bootstrap.Modal(modalEl)
  let selectedDate = null

  // signal JS loaded
  try {
    const status = document.getElementById('jsStatus')
    if (status) {
      status.textContent = 'JS Loaded'
      status.classList.remove('bg-secondary')
      status.classList.add('bg-success')
    }
    console.info('app.js: loaded')
  } catch (e) {
    console.warn('app.js: could not set JS status', e)
  }

  async function fetchTodos(d) {
    const r = await fetch(`/api/todos?date=${d}`)
    return r.json()
  }

  function renderTodos(list) {
    const ul = document.getElementById('todoList')
    ul.innerHTML = ''
    if (!list.length) {
      const li = document.createElement('li')
      li.className = 'list-group-item text-muted'
      li.textContent = '할 일이 없습니다.'
      ul.appendChild(li)
      return
    }
    list.forEach(item => {
      const li = document.createElement('li')
      li.className = 'list-group-item d-flex justify-content-between align-items-start'
      li.textContent = item.text
      const btn = document.createElement('button')
      btn.className = 'btn btn-sm btn-outline-danger'
      btn.textContent = '삭제'
      btn.addEventListener('click', () => {
        fetch(`/api/todos/${item.id}`, { method: 'DELETE' }).then(() => {
          loadAndRender(selectedDate)
          refreshCounts()
        })
      })
      li.appendChild(btn)
      ul.appendChild(li)
    })
  }

  async function loadAndRender(d) {
    const list = await fetchTodos(d)
    renderTodos(list)
    document.getElementById('modalTitle').textContent = `${d} 할 일`
    bsModal.show()
  }

  async function refreshCounts() {
    const cells = document.querySelectorAll('.day-cell')
    await Promise.all(Array.from(cells).map(async cell => {
      const d = cell.dataset.date
      const list = await fetch(`/api/todos?date=${d}`).then(r => r.json())
      let badge = cell.querySelector('.todo-count')
      if (list.length) {
        if (!badge) {
          badge = document.createElement('div')
          badge.className = 'badge bg-success todo-count'
          cell.appendChild(badge)
        }
        badge.textContent = list.length
      } else if (badge) {
        badge.remove()
      }
    }))
  }

  function bindDayCells() {
    document.querySelectorAll('.day-cell').forEach(cell => {
      cell.removeEventListener('click', dayCellClick)
      cell.addEventListener('click', dayCellClick)
    })
  }

  function dayCellClick(e) {
    selectedDate = e.currentTarget.dataset.date
    loadAndRender(selectedDate)
  }

  document.getElementById('addTodoBtn').addEventListener('click', () => {
    const txt = document.getElementById('todoInput').value.trim()
    if (!txt || !selectedDate) return
    fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, text: txt })
    }).then(r => r.json()).then(() => {
      document.getElementById('todoInput').value = ''
      loadAndRender(selectedDate)
      refreshCounts()
    })
  })

  // month navigation with smooth slide animation
  async function ajaxLoadMonth(url, direction) {
    try {
      const html = await fetch(url).then(r => r.text())
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const newCal = doc.querySelector('.calendar')
      const newChar = doc.querySelector('.character-img')
      if (!newCal) { window.location.href = url; return }

      const viewport = document.querySelector('.calendar-viewport')
      const oldCal = viewport.querySelector('.calendar')

      // lock height to prevent layout jump
      viewport.style.height = oldCal.offsetHeight + 'px'

      // prepare new element
      const clone = newCal.cloneNode(true)
      clone.style.position = 'absolute'
      clone.style.top = '0'
      clone.style.left = (direction === 'left' ? '100%' : '-100%')
      clone.style.width = '100%'
      clone.style.transition = 'transform 400ms ease'
      oldCal.style.transition = 'transform 400ms ease'

      viewport.appendChild(clone)

      // trigger animation
      requestAnimationFrame(() => {
        oldCal.style.transform = (direction === 'left' ? 'translateX(-100%)' : 'translateX(100%)')
        clone.style.transform = 'translateX(0)'
      })

      // after animation, remove old and reset
      setTimeout(() => {
        oldCal.remove()
        clone.style.position = ''
        clone.style.top = ''
        clone.style.left = ''
        clone.style.width = ''
        clone.style.transition = ''
        clone.style.transform = ''
        viewport.style.height = ''

        // update character image
        const charImg = document.querySelector('.character-img')
        if (newChar && charImg) charImg.src = newChar.src

        // rebind day cells and refresh counts
        bindDayCells()
        refreshCounts()

        // update URL without reload
        history.pushState({}, '', url)
      }, 420)
    } catch (err) {
      console.error('ajaxLoadMonth error', err)
      window.location.href = url
    }
  }

  // attach navigation handlers
  const prev = document.getElementById('prevBtn')
  const next = document.getElementById('nextBtn')
  const todayBtn = document.getElementById('todayBtn')
  if (prev) prev.addEventListener('click', (e) => { e.preventDefault(); console.log('nav prev clicked'); ajaxLoadMonth(prev.href, 'right') })
  if (next) next.addEventListener('click', (e) => { e.preventDefault(); console.log('nav next clicked'); ajaxLoadMonth(next.href, 'left') })
  if (todayBtn) todayBtn.addEventListener('click', (e) => { e.preventDefault(); console.log('nav today clicked'); ajaxLoadMonth(todayBtn.href, 'right') })

  // handle back/forward
  window.addEventListener('popstate', (e) => {
    // simply load without animation
    fetch(location.href).then(r => r.text()).then(html => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const newCal = doc.querySelector('.calendar')
      const viewport = document.querySelector('.calendar-viewport')
      const oldCal = viewport.querySelector('.calendar')
      if (newCal && oldCal) {
        oldCal.replaceWith(newCal.cloneNode(true))
        const newChar = doc.querySelector('.character-img')
        const charImg = document.querySelector('.character-img')
        if (newChar && charImg) charImg.src = newChar.src
        bindDayCells()
        refreshCounts()
      }
    })
  })

  // initial bindings
  bindDayCells()
  refreshCounts()
})
