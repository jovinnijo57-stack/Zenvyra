/**
 * FitPulse - Premium Fitness Tracker
 * Frontend Application Logic
 */

const API_BASE = '/api';

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    token: localStorage.getItem('fitpulse_token'),
    user: JSON.parse(localStorage.getItem('fitpulse_user') || 'null'),
    categories: [],
    currentPage: 'dashboard'
};

// ============================================
// API HELPER
// ============================================
async function api(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {})
    };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Something went wrong');
        }

        return data;
    } catch (err) {
        if (err.message === 'Failed to fetch') {
            throw new Error('Server is not reachable. Please ensure the backend is running.');
        }
        throw err;
    }
}

// ============================================
// AUTH
// ============================================
function initAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const authError = document.getElementById('auth-error');

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        authError.textContent = '';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
        authError.textContent = '';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const btn = document.getElementById('login-btn');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div>';

        try {
            const data = await api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: document.getElementById('login-username').value,
                    password: document.getElementById('login-password').value
                })
            });

            state.token = data.access_token;
            state.user = data.user;
            localStorage.setItem('fitpulse_token', data.access_token);
            localStorage.setItem('fitpulse_user', JSON.stringify(data.user));

            showApp();
        } catch (err) {
            authError.textContent = err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Sign In</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const btn = document.getElementById('register-btn');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div>';

        try {
            const data = await api('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    full_name: document.getElementById('reg-fullname').value,
                    username: document.getElementById('reg-username').value,
                    email: document.getElementById('reg-email').value,
                    password: document.getElementById('reg-password').value
                })
            });

            // Clear register form and switch to login
            registerForm.reset();
            registerForm.classList.remove('active');
            document.getElementById('login-form').classList.add('active');
            
            showToast('Account created! Please sign in. 🎉', 'success');
        } catch (err) {
            authError.textContent = err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Create Account</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        state.token = null;
        state.user = null;
        localStorage.removeItem('fitpulse_token');
        localStorage.removeItem('fitpulse_user');
        
        // Clear auth forms so details are not seen
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        
        showAuth();
    });
}

function showAuth() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
}

function showApp() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');

    updateUserUI();
    loadCategories();
    navigateTo('dashboard');
}

function updateUserUI() {
    const initials = state.user?.full_name
        ? state.user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : state.user?.username?.[0]?.toUpperCase() || 'U';

    document.getElementById('avatar-initials').textContent = initials;
    document.getElementById('profile-initials').textContent = initials;
    document.getElementById('page-subtitle').textContent = `Welcome back, ${state.user?.full_name || state.user?.username || 'User'}!`;
}

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Card links
    document.querySelectorAll('.card-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // Mobile menu
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        toggleOverlay();
    });
}

function toggleOverlay() {
    let overlay = document.querySelector('.sidebar-overlay');
    const sidebar = document.getElementById('sidebar');

    if (sidebar.classList.contains('open')) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay active';
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
            document.body.appendChild(overlay);
        } else {
            overlay.classList.add('active');
        }
    } else if (overlay) {
        overlay.classList.remove('active');
    }
}

function navigateTo(page) {
    state.currentPage = page;

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');

    // Update title
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: `Welcome back, ${state.user?.full_name || state.user?.username || 'User'}!` },
        workouts: { title: 'Workouts', subtitle: 'Track your training sessions' },
        goals: { title: 'Goals', subtitle: 'Set and achieve your targets' },
        progress: { title: 'Progress', subtitle: 'Monitor your fitness journey' },
        nutrition: { title: 'Nutrition & Water', subtitle: 'Track your diet and hydration 💧' },
        community: { title: 'Community', subtitle: 'Leaderboards and social feed 🌍' },
        coach: { title: 'AI Coach', subtitle: 'Smart insights and motivation 🤖' },
        profile: { title: 'Profile', subtitle: 'Manage your account' }
    };

    const t = titles[page] || titles.dashboard;
    document.getElementById('page-title').textContent = t.title;
    document.getElementById('page-subtitle').textContent = t.subtitle;

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');

    // Load page data
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'workouts': loadWorkouts(); break;
        case 'goals': loadGoals(); break;
        case 'progress': loadProgress(); break;
        case 'nutrition': loadNutrition(); break;
        case 'community': loadCommunity(); break;
        case 'coach': loadCoach(); break;
        case 'profile': loadProfile(); break;
    }
}

// ============================================
// CATEGORIES
// ============================================
async function loadCategories() {
    try {
        const data = await api('/workouts/categories');
        state.categories = data.categories;
    } catch (err) {
        console.error('Failed to load categories:', err);
    }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    try {
        const data = await api('/stats/dashboard');

        // Update stat cards with animated counting
        animateValue('total-workouts-value', data.total_workouts);
        animateValue('streak-value', data.current_streak);
        animateValue('week-minutes-value', data.week?.minutes || 0);
        animateValue('week-calories-value', data.week?.calories || 0);

        // Render weekly chart
        renderWeeklyChart(data.daily_activity || []);

        // Render category breakdown
        renderCategoryChart(data.category_breakdown || []);

        // Render recent workouts
        renderRecentWorkouts(data.recent_workouts || []);

        // Render active goals
        renderActiveGoals(data.active_goals || []);

        // Update monthly stats
        document.getElementById('month-workouts').textContent = data.month?.total || 0;
        document.getElementById('month-minutes').textContent = data.month?.minutes || 0;
        document.getElementById('month-calories').textContent = data.month?.calories || 0;

    } catch (err) {
        console.error('Dashboard error:', err);
    }
}

function animateValue(elementId, target) {
    const el = document.getElementById(elementId);
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function renderWeeklyChart(data) {
    const container = document.getElementById('weekly-chart');
    const maxMinutes = Math.max(...data.map(d => d.minutes), 1);

    container.innerHTML = data.map(d => {
        const height = Math.max((d.minutes / maxMinutes) * 100, 3);
        return `
            <div class="bar-item">
                <span class="bar-value">${d.minutes}m</span>
                <div class="bar-fill-container">
                    <div class="bar-fill" style="height: ${height}%"></div>
                </div>
                <span class="bar-label">${d.day}</span>
            </div>
        `;
    }).join('');
}

function renderCategoryChart(data) {
    const container = document.getElementById('category-chart');

    if (!data.length) {
        container.innerHTML = '<div class="donut-placeholder"><p>Log workouts to see your split</p></div>';
        return;
    }

    const total = data.reduce((sum, d) => sum + d.count, 0);
    let cumulativePercent = 0;

    const segments = data.map(d => {
        const percent = (d.count / total) * 100;
        const start = cumulativePercent;
        cumulativePercent += percent;
        return { ...d, percent, start };
    });

    // Build SVG donut
    const size = 160;
    const radius = 60;
    const center = size / 2;
    let svgPaths = '';

    segments.forEach(seg => {
        const startAngle = (seg.start / 100) * 360 - 90;
        const endAngle = ((seg.start + seg.percent) / 100) * 360 - 90;
        const largeArc = seg.percent > 50 ? 1 : 0;

        const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180);
        const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180);
        const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180);
        const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180);

        svgPaths += `<path d="M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${seg.color}" opacity="0.85"/>`;
    });

    // Inner circle for donut effect
    svgPaths += `<circle cx="${center}" cy="${center}" r="35" fill="${getComputedStyle(document.body).getPropertyValue('--bg-primary').trim() || '#0a0a1a'}"/>`;

    const legend = segments.map(s =>
        `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.icon} ${s.name} (${s.count})</div>`
    ).join('');

    container.innerHTML = `
        <svg class="donut-svg" viewBox="0 0 ${size} ${size}">${svgPaths}</svg>
        <div class="donut-legend">${legend}</div>
    `;
}

function renderRecentWorkouts(workouts) {
    const container = document.getElementById('recent-workouts-list');

    if (!workouts.length) {
        container.innerHTML = '<div class="empty-state small"><p>No workouts yet. Start tracking!</p></div>';
        return;
    }

    container.innerHTML = workouts.map(w => `
        <div class="workout-list-item">
            <div class="workout-icon" style="background: ${w.category_color}20">
                <span>${w.category_icon}</span>
            </div>
            <div class="workout-info">
                <div class="workout-title">${escapeHtml(w.title)}</div>
                <div class="workout-meta">
                    <span>${w.category_name}</span>
                    <span>${w.duration_minutes} min</span>
                    <span>${formatDate(w.workout_date)}</span>
                </div>
            </div>
            <span class="intensity-badge intensity-${w.intensity}">${w.intensity}</span>
        </div>
    `).join('');
}

function renderActiveGoals(goals) {
    const container = document.getElementById('active-goals-list');

    if (!goals.length) {
        container.innerHTML = '<div class="empty-state small"><p>No active goals. Set a target!</p></div>';
        return;
    }

    container.innerHTML = goals.map(g => {
        const percent = g.target_value > 0 ? Math.min((g.current_value / g.target_value) * 100, 100) : 0;
        return `
            <div class="goal-item">
                <div class="goal-header">
                    <span class="goal-title">${escapeHtml(g.title)}</span>
                    <span class="goal-percentage">${Math.round(percent)}%</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${percent}%"></div>
                </div>
                <div class="goal-meta">
                    <span>${g.current_value} / ${g.target_value} ${g.unit || ''}</span>
                    <span>Due: ${formatDate(g.end_date)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// WORKOUTS PAGE
// ============================================
async function loadWorkouts() {
    try {
        const data = await api('/workouts');
        const container = document.getElementById('workouts-list');

        if (!data.workouts.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💪</div>
                    <h3>No workouts yet</h3>
                    <p>Start tracking your fitness journey by adding your first workout!</p>
                </div>`;
            return;
        }

        container.innerHTML = data.workouts.map(w => `
            <div class="workout-list-item">
                <div class="workout-icon" style="background: ${w.category_color}20">
                    <span>${w.category_icon}</span>
                </div>
                <div class="workout-info">
                    <div class="workout-title">${escapeHtml(w.title)}</div>
                    <div class="workout-meta">
                        <span>${w.category_name}</span>
                        <span>${w.duration_minutes} min</span>
                        <span>${w.calories_burned || 0} cal</span>
                        <span>${formatDate(w.workout_date)}</span>
                    </div>
                </div>
                <span class="intensity-badge intensity-${w.intensity}">${w.intensity}</span>
                <div class="workout-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteWorkout(${w.id})">✕</button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Workouts error:', err);
    }
}

document.getElementById('add-workout-btn')?.addEventListener('click', () => showAddWorkoutModal());

function showAddWorkoutModal() {
    const categoryOptions = state.categories.map(c =>
        `<option value="${c.id}">${c.icon} ${c.name}</option>`
    ).join('');

    openModal('Add Workout', `
        <form id="workout-form">
            <div class="form-group">
                <label>Title *</label>
                <input type="text" id="wk-title" placeholder="e.g., Morning Run" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Category *</label>
                    <select id="wk-category" required>
                        <option value="">Select category</option>
                        ${categoryOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Intensity</label>
                    <select id="wk-intensity">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                        <option value="extreme">Extreme</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Duration (min) *</label>
                    <input type="number" id="wk-duration" placeholder="30" required min="1">
                </div>
                <div class="form-group">
                    <label>Calories Burned</label>
                    <input type="number" id="wk-calories" placeholder="200" min="0">
                </div>
            </div>
            <div class="form-group">
                <label>Date *</label>
                <input type="date" id="wk-date" required value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="wk-notes" placeholder="How did it go?"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Save Workout</button>
        </form>
    `);

    document.getElementById('workout-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            await api('/workouts', {
                method: 'POST',
                body: JSON.stringify({
                    title: document.getElementById('wk-title').value,
                    category_id: parseInt(document.getElementById('wk-category').value),
                    intensity: document.getElementById('wk-intensity').value,
                    duration_minutes: parseInt(document.getElementById('wk-duration').value),
                    calories_burned: parseInt(document.getElementById('wk-calories').value) || 0,
                    workout_date: document.getElementById('wk-date').value,
                    notes: document.getElementById('wk-notes').value
                })
            });

            closeModal();
            showToast('Workout added! 💪', 'success');
            loadWorkouts();

        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function deleteWorkout(id) {
    if (!confirm('Delete this workout?')) return;

    try {
        await api(`/workouts/${id}`, { method: 'DELETE' });
        showToast('Workout deleted', 'info');
        loadWorkouts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// GOALS PAGE
// ============================================
async function loadGoals() {
    try {
        const data = await api('/goals');
        const container = document.getElementById('goals-page-list');

        if (!data.goals.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <h3>No goals set</h3>
                    <p>Define your fitness targets and track your progress!</p>
                </div>`;
            return;
        }

        container.innerHTML = data.goals.map(g => {
            const percent = g.target_value > 0 ? Math.min((g.current_value / g.target_value) * 100, 100) : 0;
            return `
                <div class="goal-item ${g.is_completed ? 'completed' : ''}">
                    <div class="goal-header">
                        <span class="goal-title">${g.is_completed ? '✅ ' : ''}${escapeHtml(g.title)}</span>
                        <span class="goal-percentage">${Math.round(percent)}%</span>
                    </div>
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill" style="width: ${percent}%"></div>
                    </div>
                    <div class="goal-meta">
                        <span>${g.current_value} / ${g.target_value} ${g.unit || ''}</span>
                        <span>${formatDate(g.start_date)} → ${formatDate(g.end_date)}</span>
                    </div>
                    <div class="goal-actions">
                        ${!g.is_completed ? `
                            <button class="btn btn-outline btn-sm" onclick="showUpdateGoalModal(${g.id}, ${g.current_value}, ${g.target_value})">Update Progress</button>
                            <button class="btn btn-primary btn-sm" onclick="completeGoal(${g.id})">Mark Complete</button>
                        ` : ''}
                        <button class="btn btn-danger btn-sm" onclick="deleteGoal(${g.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Goals error:', err);
    }
}

document.getElementById('add-goal-btn')?.addEventListener('click', () => showAddGoalModal());

function showAddGoalModal() {
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    openModal('Set New Goal', `
        <form id="goal-form">
            <div class="form-group">
                <label>Goal Title *</label>
                <input type="text" id="gl-title" placeholder="e.g., Run 100km this month" required>
            </div>
            <div class="form-group">
                <label>Goal Type *</label>
                <select id="gl-type" required>
                    <option value="">Select type</option>
                    <option value="workout_count">Workout Count</option>
                    <option value="duration">Total Duration</option>
                    <option value="calories">Calories Burned</option>
                    <option value="weight">Target Weight</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Target Value *</label>
                    <input type="number" id="gl-target" placeholder="100" required min="1" step="0.1">
                </div>
                <div class="form-group">
                    <label>Unit</label>
                    <input type="text" id="gl-unit" placeholder="km, reps, kg...">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Start Date *</label>
                    <input type="date" id="gl-start" value="${today}" required>
                </div>
                <div class="form-group">
                    <label>End Date *</label>
                    <input type="date" id="gl-end" value="${nextMonth}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="gl-desc" placeholder="Describe your goal..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Create Goal</button>
        </form>
    `);

    document.getElementById('goal-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            await api('/goals', {
                method: 'POST',
                body: JSON.stringify({
                    title: document.getElementById('gl-title').value,
                    goal_type: document.getElementById('gl-type').value,
                    target_value: parseFloat(document.getElementById('gl-target').value),
                    unit: document.getElementById('gl-unit').value,
                    start_date: document.getElementById('gl-start').value,
                    end_date: document.getElementById('gl-end').value,
                    description: document.getElementById('gl-desc').value
                })
            });

            closeModal();
            showToast('Goal created! 🎯', 'success');
            loadGoals();

        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function showUpdateGoalModal(goalId, currentValue, targetValue) {
    openModal('Update Progress', `
        <form id="update-goal-form">
            <div class="form-group">
                <label>Current Progress</label>
                <input type="number" id="ug-value" value="${currentValue}" step="0.1" required>
                <p style="color: var(--text-muted); font-size:12px; margin-top:4px;">Target: ${targetValue}</p>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Update</button>
        </form>
    `);

    document.getElementById('update-goal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api(`/goals/${goalId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    current_value: parseFloat(document.getElementById('ug-value').value)
                })
            });
            closeModal();
            showToast('Progress updated!', 'success');
            loadGoals();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function completeGoal(id) {
    try {
        await api(`/goals/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_completed: true })
        });
        showToast('Goal completed! 🏆', 'success');
        loadGoals();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    try {
        await api(`/goals/${id}`, { method: 'DELETE' });
        showToast('Goal deleted', 'info');
        loadGoals();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// PROGRESS PAGE
// ============================================
async function loadProgress() {
    try {
        const [dashData, weightData] = await Promise.all([
            api('/stats/dashboard'),
            api('/stats/weight')
        ]);

        // Monthly stats
        document.getElementById('month-workouts').textContent = dashData.month?.total || 0;
        document.getElementById('month-minutes').textContent = dashData.month?.minutes || 0;
        document.getElementById('month-calories').textContent = dashData.month?.calories || 0;

        // Weight chart
        renderWeightChart(weightData.weight_history || []);

    } catch (err) {
        console.error('Progress error:', err);
    }
}

function renderWeightChart(data) {
    const container = document.getElementById('weight-chart');

    if (!data.length) {
        container.innerHTML = '<div class="empty-state small"><p>Log your weight to see trends</p></div>';
        return;
    }

    const reversed = [...data].reverse();
    const width = container.clientWidth || 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const weights = reversed.map(d => d.weight_kg);
    const minW = Math.min(...weights) - 1;
    const maxW = Math.max(...weights) + 1;

    const points = reversed.map((d, i) => {
        const x = padding.left + (i / (reversed.length - 1 || 1)) * chartW;
        const y = padding.top + chartH - ((d.weight_kg - minW) / (maxW - minW || 1)) * chartH;
        return { x, y, weight: d.weight_kg, date: d.log_date };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Area path
    const areaPath = pathData + ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

    container.innerHTML = `
        <svg class="weight-chart-svg" viewBox="0 0 ${width} ${height}">
            <defs>
                <linearGradient id="weight-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#weight-gradient)"/>
            <path d="${pathData}" fill="none" stroke="#6366f1" stroke-width="2"/>
            ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#6366f1" stroke="#0a0a1a" stroke-width="2"/>`).join('')}
            ${points.filter((_, i) => i === 0 || i === points.length - 1).map(p =>
                `<text x="${p.x}" y="${padding.top + chartH + 18}" fill="#94a3b8" text-anchor="middle" font-size="11">${p.date}</text>`
            ).join('')}
        </svg>
    `;
}

document.getElementById('log-weight-btn')?.addEventListener('click', () => {
    openModal('Log Weight', `
        <form id="weight-form">
            <div class="form-group">
                <label>Weight (kg) *</label>
                <input type="number" id="lw-weight" step="0.1" required placeholder="70.5">
            </div>
            <div class="form-group">
                <label>Body Fat % (optional)</label>
                <input type="number" id="lw-bodyfat" step="0.1" placeholder="15.0">
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" id="lw-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="lw-notes" placeholder="How are you feeling?"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Log Weight</button>
        </form>
    `);

    document.getElementById('weight-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api('/stats/weight', {
                method: 'POST',
                body: JSON.stringify({
                    weight_kg: parseFloat(document.getElementById('lw-weight').value),
                    body_fat_percent: parseFloat(document.getElementById('lw-bodyfat').value) || null,
                    log_date: document.getElementById('lw-date').value,
                    notes: document.getElementById('lw-notes').value
                })
            });
            closeModal();
            showToast('Weight logged! ⚖️', 'success');
            loadProgress();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
});

// ============================================
// PROFILE PAGE
// ============================================
async function loadProfile() {
    try {
        const data = await api('/profile');
        const user = data.user;

        document.getElementById('profile-name').textContent = user.full_name || user.username;
        document.getElementById('profile-email').textContent = user.email;
        document.getElementById('profile-fullname').value = user.full_name || '';
        document.getElementById('profile-age').value = user.age || '';
        document.getElementById('profile-gender').value = user.gender || '';
        document.getElementById('profile-height').value = user.height_cm || '';
        document.getElementById('profile-weight').value = user.weight_kg || '';

        const initials = user.full_name
            ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
            : user.username?.[0]?.toUpperCase() || 'U';
        document.getElementById('profile-initials').textContent = initials;

    } catch (err) {
        console.error('Profile error:', err);
    }
}

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        await api('/profile', {
            method: 'PUT',
            body: JSON.stringify({
                full_name: document.getElementById('profile-fullname').value,
                age: parseInt(document.getElementById('profile-age').value) || null,
                gender: document.getElementById('profile-gender').value || null,
                height_cm: parseFloat(document.getElementById('profile-height').value) || null,
                weight_kg: parseFloat(document.getElementById('profile-weight').value) || null
            })
        });

        // Update local state
        state.user.full_name = document.getElementById('profile-fullname').value;
        localStorage.setItem('fitpulse_user', JSON.stringify(state.user));
        updateUserUI();

        showToast('Profile updated!', 'success');

    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ============================================
// MODAL
// ============================================
function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };

    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// UTILITIES
// ============================================
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();

    // Check if user is already logged in
    if (state.token && state.user) {
        showApp();
    } else {
        showAuth();
    }
});



// ============================================
// GOOGLE AUTHENTICATION
// ============================================
function handleGoogleLogin() {
    showToast("Google login requires OAuth setup (e.g. Supabase Auth) on the backend. This UI acts as a placeholder.", "info");
}

// ============================================
// NEW ADVANCED FEATURES
// ============================================

async function loadNutrition() {
    try {
        const data = await api('/nutrition/daily');
        const values = document.querySelectorAll('#page-nutrition .stat-value');
        if(values.length >= 3) {
            values[0].textContent = data.totals.calories || 0;
            values[1].textContent = (data.totals.protein || 0) + 'g';
            values[2].textContent = (data.totals.water_ml || 0) + 'ml';
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadCommunity() {
    try {
        const data = await api('/social/leaderboard');
        const board = document.querySelector('#page-community .stats-grid .stat-card:nth-child(1) .workout-list');
        if (board && data.leaderboard && data.leaderboard.length) {
            board.innerHTML = data.leaderboard.map((u, i) => `
                <div class="workout-list-item" style="padding: 10px; border-bottom: 1px solid var(--border-color);">
                    <div style="font-size: 1.2rem; margin-right: 15px; font-weight: bold;">#${i+1}</div>
                    <div class="workout-info">
                        <div class="workout-title">${escapeHtml(u.username)}</div>
                        <div class="workout-meta"><span>Level ${u.level || 1}</span></div>
                    </div>
                    <span class="intensity-badge intensity-high">${u.xp_points || 0} XP</span>
                </div>
            `).join('');
        }
        
        const postsData = await api('/social/posts');
        const feed = document.querySelector('#page-community .stats-grid .stat-card:nth-child(2) .workout-list');
        if (feed && postsData.posts && postsData.posts.length) {
            feed.innerHTML = postsData.posts.map(p => `
                <div class="workout-list-item" style="padding: 10px; border-bottom: 1px solid var(--border-color); flex-direction:column; align-items:flex-start;">
                    <div style="display:flex; justify-content:space-between; width:100%; margin-bottom: 5px;">
                        <strong>@${escapeHtml(p.username)}</strong>
                        <small style="color:var(--text-muted)">${p.created_at.split('T')[0]}</small>
                    </div>
                    <div style="margin-bottom: 10px;">${escapeHtml(p.content)}</div>
                    <div style="color:var(--primary-color);">❤️ ${p.likes}</div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadCoach() {
    try {
        const data = await api('/coach/insights');
        const container = document.getElementById('coach-insights-list');
        
        if (!container) return;
        if (!data.insights || !data.insights.length) {
            container.innerHTML = '<div class="empty-state small"><p>Not enough data. Log workouts to get insights.</p></div>';
            return;
        }
        
        container.innerHTML = data.insights.map(i => {
            let icon = '💡';
            if (i.type === 'positive') icon = '🚀';
            if (i.type === 'warning') icon = '⚠️';
            if (i.type === 'info') icon = '💧';
            
            return `
            <div class="glass-card" style="padding: 15px; display:flex; gap: 15px; align-items: flex-start;">
                <div style="font-size: 1.5rem;">${icon}</div>
                <div>
                    <h4 style="margin: 0 0 5px 0;">${escapeHtml(i.title)}</h4>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">${escapeHtml(i.message)}</p>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error(e);
    }
}
