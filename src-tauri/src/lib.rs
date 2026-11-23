use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, PhysicalPosition, State, UserAttentionType, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

const MAIN: &str = "main";
const TOAST: &str = "toast";

/// Logical size/spacing of the toast window.
const TOAST_WIDTH: f64 = 400.0;
const TOAST_BASE_HEIGHT: f64 = 190.0;
const TOAST_ROW_HEIGHT: f64 = 84.0;
const SCREEN_MARGIN: f64 = 16.0;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum ToastPosition {
    RightTop,
    #[default]
    RightBottom,
    Middle,
}

/// Mirrors `Settings` in src/shared.ts.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Settings {
    body_parts: Vec<String>,
    interval_minutes: u32,
    position: ToastPosition,
    duration_seconds: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            body_parts: Vec::new(),
            interval_minutes: 60,
            position: ToastPosition::RightBottom,
            duration_seconds: 60,
        }
    }
}

impl Settings {
    /// Interval: 15 min – 4 h in 15 min steps.
    /// Notification lifetime: 20 s – 1 min in 10 s steps, then 30 s steps up to 7 min.
    fn sanitized(mut self) -> Self {
        let mut seen = HashSet::new();
        self.body_parts.retain(|p| seen.insert(p.clone()));
        self.interval_minutes = self.interval_minutes.clamp(15, 240) / 15 * 15;
        let d = self.duration_seconds.clamp(20, 420);
        self.duration_seconds = if d <= 60 { d / 10 * 10 } else { d / 30 * 30 };
        self
    }

    fn interval(&self) -> Duration {
        Duration::from_secs(u64::from(self.interval_minutes) * 60)
    }
}

fn settings_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("settings.json"))
}

fn load_settings(app: &AppHandle) -> Option<Settings> {
    let raw = fs::read_to_string(settings_path(app)?).ok()?;
    let settings = serde_json::from_str::<Settings>(&raw).ok()?.sanitized();
    (!settings.body_parts.is_empty()).then_some(settings)
}

fn write_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app).ok_or("Could not find a config directory")?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

struct AppState {
    /// `None` until the first-run setup has been saved.
    settings: Mutex<Option<Settings>>,
    /// When the next reminder fires. Paused (`None`) while unconfigured.
    next_due: Mutex<Option<Instant>>,
    /// True from the moment a toast is requested until it is completed and destroyed.
    toast_open: AtomicBool,
    /// Pending slide-in for a toast that is still loading: (start_x, target_x, y), physical px.
    toast_slide_in: Mutex<Option<(i32, i32, i32)>>,
    stats: Mutex<Stats>,
}

/// Counted since launch. Mirrors `Stats` in src/shared.ts.
#[derive(Clone, Copy, Debug, Default, Serialize)]
struct Stats {
    completed: u32,
    missed: u32,
}

/// A missed reminder comes back after this long instead of a full interval.
const MISSED_RETRY: Duration = Duration::from_secs(5 * 60);

impl AppState {
    fn restart_timer(&self) {
        let settings = self.settings.lock().unwrap();
        *self.next_due.lock().unwrap() = settings.as_ref().map(|s| Instant::now() + s.interval());
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Option<Settings> {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<'_, AppState>, settings: Settings) -> Result<(), String> {
    let settings = settings.sanitized();
    if settings.body_parts.is_empty() {
        return Err("Pick at least one body part to stretch.".into());
    }
    write_settings(&app, &settings)?;
    *state.settings.lock().unwrap() = Some(settings);
    state.restart_timer();
    Ok(())
}

#[tauri::command]
fn get_stats(state: State<'_, AppState>) -> Stats {
    *state.stats.lock().unwrap()
}

#[tauri::command]
fn hide_main(app: AppHandle) {
    if let Some(main) = app.get_webview_window(MAIN) {
        let _ = main.hide();
    }
}

/// Clicking the notification brings up the app window (details, adjustments, quit).
#[tauri::command]
fn open_main(app: AppHandle) {
    show_main(&app);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Seconds until the next reminder, or `None` if paused / a stretch is in progress.
#[tauri::command]
fn seconds_until_next(state: State<'_, AppState>) -> Option<u64> {
    if state.toast_open.load(Ordering::SeqCst) {
        return None;
    }
    state
        .next_due
        .lock()
        .unwrap()
        .map(|due| due.saturating_duration_since(Instant::now()).as_secs())
}

// Window-creating commands are async so they don't block the main thread (deadlocks on Windows).
#[tauri::command]
async fn stretch_now(app: AppHandle) -> Result<(), String> {
    show_toast(&app)
}

/// Called by the toast page once it has rendered, so it slides in fully painted.
#[tauri::command]
async fn toast_ready(app: AppHandle) {
    reveal_toast(&app);
}

/// Shake the toast window and grab attention. Used on premature "Complete" and when ignored.
#[tauri::command]
async fn nudge_toast(app: AppHandle) {
    let Some(win) = app.get_webview_window(TOAST) else { return };
    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.set_always_on_top(true);
    let _ = win.set_focus();
    let _ = win.request_user_attention(Some(UserAttentionType::Critical));
    if let Ok(origin) = win.outer_position() {
        let amp = (8.0 * win.scale_factor().unwrap_or(1.0)).round() as i32;
        for dx in [amp, -amp, amp, -amp, amp / 2, -amp / 2, 0] {
            let _ = win.set_position(PhysicalPosition::new(origin.x + dx, origin.y));
            thread::sleep(Duration::from_millis(35));
        }
    }
}

/// The page verified every part was stretched.
#[tauri::command]
async fn complete_stretch(app: AppHandle) {
    let state = app.state::<AppState>();
    state.stats.lock().unwrap().completed += 1;
    state.restart_timer();
    slide_out_toast(&app);
}

/// The notification timed out before the user started stretching.
#[tauri::command]
async fn dismiss_toast(app: AppHandle) {
    let state = app.state::<AppState>();
    state.stats.lock().unwrap().missed += 1;
    *state.next_due.lock().unwrap() = Some(Instant::now() + MISSED_RETRY);
    slide_out_toast(&app);
}

fn slide_out_toast(app: &AppHandle) {
    let Some(win) = app.get_webview_window(TOAST) else {
        app.state::<AppState>().toast_open.store(false, Ordering::SeqCst);
        return;
    };
    let handle = app.clone();
    let done = {
        let win = win.clone();
        move || {
            let _ = win.destroy();
            handle.state::<AppState>().toast_open.store(false, Ordering::SeqCst);
        }
    };
    match (win.outer_position(), right_edge(&win)) {
        (Ok(pos), Some(edge)) => slide(win, pos.x, edge, pos.y, done),
        _ => done(),
    }
}

// ---------------------------------------------------------------------------
// Toast window
// ---------------------------------------------------------------------------

fn show_toast(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = state
        .settings
        .lock()
        .unwrap()
        .clone()
        .ok_or("Set up your stretch routine first.")?;

    // Already showing: just bring it forward.
    if state.toast_open.swap(true, Ordering::SeqCst) {
        if let Some(win) = app.get_webview_window(TOAST) {
            let _ = win.show();
            let _ = win.set_focus();
        }
        return Ok(());
    }

    open_toast(app, &settings).inspect_err(|_| {
        state.toast_open.store(false, Ordering::SeqCst);
    })
}

fn open_toast(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let monitor = app
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| {
            app.get_webview_window(MAIN)
                .and_then(|w| w.current_monitor().ok().flatten())
        })
        .ok_or("No monitor found")?;

    let scale = monitor.scale_factor();
    let area = monitor.work_area(); // excludes menu bar / dock / taskbar
    let (ax, ay) = (area.position.x, area.position.y);
    let (aw, ah) = (area.size.width as i32, area.size.height as i32);

    let rows = settings.body_parts.len().max(1) as f64;
    let max_height = f64::from(ah) / scale - 2.0 * SCREEN_MARGIN;
    let logical_height = (TOAST_BASE_HEIGHT + TOAST_ROW_HEIGHT * rows).min(max_height);

    let w = (TOAST_WIDTH * scale).round() as i32;
    let h = (logical_height * scale).round() as i32;
    let m = (SCREEN_MARGIN * scale).round() as i32;

    let (target_x, y) = match settings.position {
        ToastPosition::RightTop => (ax + aw - w - m, ay + m),
        ToastPosition::RightBottom => (ax + aw - w - m, ay + ah - h - m),
        ToastPosition::Middle => (ax + (aw - w) / 2, ay + (ah - h) / 2),
    };
    // Start just past the right edge of the screen and slide in from there.
    let start_x = ax + aw;

    *app.state::<AppState>().toast_slide_in.lock().unwrap() = Some((start_x, target_x, y));

    WebviewWindowBuilder::new(app, TOAST, WebviewUrl::App("toast.html".into()))
        .title("Time to stretch!!")
        .inner_size(TOAST_WIDTH, logical_height)
        .position(f64::from(start_x) / scale, f64::from(y) / scale)
        .decorations(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(true)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;

    // Safety net: if the page never reports ready, slide in anyway.
    let handle = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(2500));
        reveal_toast(&handle);
    });

    Ok(())
}

fn reveal_toast(app: &AppHandle) {
    let Some(win) = app.get_webview_window(TOAST) else { return };
    let Some((start_x, target_x, y)) = app.state::<AppState>().toast_slide_in.lock().unwrap().take()
    else {
        return;
    };
    let _ = win.set_position(PhysicalPosition::new(start_x, y));
    let _ = win.show();
    let _ = win.set_focus();
    slide(win, start_x, target_x, y, || {});
}

fn right_edge(win: &WebviewWindow) -> Option<i32> {
    let monitor = win.current_monitor().ok().flatten()?;
    let area = monitor.work_area();
    Some(area.position.x + area.size.width as i32)
}

/// Animate the window horizontally with an ease-out curve, then run `on_done`.
fn slide(win: WebviewWindow, from_x: i32, to_x: i32, y: i32, on_done: impl FnOnce() + Send + 'static) {
    thread::spawn(move || {
        const STEPS: u32 = 22;
        for i in 1..=STEPS {
            let t = f64::from(i) / f64::from(STEPS);
            let eased = 1.0 - (1.0 - t).powi(3);
            let x = f64::from(from_x) + f64::from(to_x - from_x) * eased;
            let _ = win.set_position(PhysicalPosition::new(x.round() as i32, y));
            thread::sleep(Duration::from_millis(12));
        }
        on_done();
    });
}

// ---------------------------------------------------------------------------
// Scheduler, tray, main window
// ---------------------------------------------------------------------------

fn spawn_scheduler(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(1));
        let state = app.state::<AppState>();
        // The countdown is frozen while a stretch is in progress.
        if state.toast_open.load(Ordering::SeqCst) {
            continue;
        }
        let due = *state.next_due.lock().unwrap();
        if matches!(due, Some(d) if Instant::now() >= d) && show_toast(&app).is_err() {
            // Try again in a minute rather than every second.
            *state.next_due.lock().unwrap() = Some(Instant::now() + Duration::from_secs(60));
        }
    });
}

fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(MAIN) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let stretch = MenuItem::with_id(app, "stretch", "Stretch now", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Stretch Reminder", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&stretch, &settings, &separator, &quit])?;

    let mut tray = TrayIconBuilder::with_id("tray")
        .tooltip("Stretch Reminder")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "stretch" => {
                let app = app.clone();
                thread::spawn(move || {
                    let _ = show_toast(&app);
                });
            }
            "settings" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_stats,
            hide_main,
            open_main,
            quit_app,
            seconds_until_next,
            stretch_now,
            toast_ready,
            nudge_toast,
            complete_stretch,
            dismiss_toast,
        ])
        .setup(|app| {
            let saved = load_settings(app.handle());
            app.manage(AppState {
                next_due: Mutex::new(saved.as_ref().map(|s| Instant::now() + s.interval())),
                settings: Mutex::new(saved),
                toast_open: AtomicBool::new(false),
                toast_slide_in: Mutex::new(None),
                stats: Mutex::new(Stats::default()),
            });
            build_tray(app)?;
            spawn_scheduler(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    // Closing settings just hides it; the app keeps running in the tray.
                    MAIN => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    // The toast can't be closed. Finish your stretch.
                    TOAST => api.prevent_close(),
                    _ => {}
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS: clicking the Dock icon reopens settings.
            if is_reopen(&event) {
                show_main(app);
            }
        });
}

#[cfg(target_os = "macos")]
fn is_reopen(event: &tauri::RunEvent) -> bool {
    matches!(event, tauri::RunEvent::Reopen { .. })
}

#[cfg(not(target_os = "macos"))]
fn is_reopen(_event: &tauri::RunEvent) -> bool {
    false
}
