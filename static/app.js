document.addEventListener('DOMContentLoaded', () => {
  const modalEl = document.getElementById('todoModal')
  const bsModal = new bootstrap.Modal(modalEl)
  let selectedDate = null

  function fetchTodos(d) {
    return fetch(`/api/todos?date=${d}`).then(r => r.json())
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

  function loadAndRender(d) {
    fetchTodos(d).then(list => {
      renderTodos(list)
      document.getElementById('modalTitle').textContent = `${d} 할 일`
      bsModal.show()
    })
  }

  function refreshCounts() {
    // quick refresh for badge counts for current visible month
    const cells = document.querySelectorAll('.day-cell')
    cells.forEach(cell => {
      const d = cell.dataset.date
      fetch(`/api/todos?date=${d}`).then(r => r.json()).then(list => {
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
      })
    })
  }

  document.querySelectorAll('.day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedDate = cell.dataset.date
      loadAndRender(selectedDate)
    })
  })

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

})
