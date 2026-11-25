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
    WebviewWindowBuilder, WindowEvent, Wry,
};

const MAIN: &str = "main";
const TOAST: &str = "toast";

/// Logical size of the (transparent) toast window. The rounded card inside is a bit
/// smaller, leaving room for its drop shadow. The body-part list scrolls inside it.
const TOAST_WIDTH: f64 = 300.0;
const TOAST_HEIGHT: f64 = 330.0;
const SCREEN_MARGIN: f64 = 8.0;

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

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Language {
    #[default]
    En,
    Ko,
}

/// Mirrors `Settings` in src/shared.ts.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Settings {
    language: Language,
    body_parts: Vec<String>,
    interval_minutes: u32,
    position: ToastPosition,
    duration_seconds: u32,
    /// Stretches to complete today. Reaching it ends the day (the app quits).
    goal: u32,
    /// The local day ("YYYY-MM-DD") the user last confirmed interval + goal.
    /// Reminders only run when this is today.
    plan_day: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            language: Language::En,
            body_parts: Vec::new(),
            interval_minutes: 60,
            position: ToastPosition::RightBottom,
            duration_seconds: 20,
            goal: 6,
            plan_day: String::new(),
        }
    }
}

impl Settings {
    /// Interval: 15 min – 4 h in 15 min steps. Goal: 1–20.
    /// Notification lifetime: 20 s – 1 min in 10 s steps, then 30 s steps up to 7 min.
    fn sanitized(mut self) -> Self {
        let mut seen = HashSet::new();
        self.body_parts.retain(|p| seen.insert(p.clone()));
        self.interval_minutes = self.interval_minutes.clamp(15, 240) / 15 * 15;
        let d = self.duration_seconds.clamp(20, 420);
        self.duration_seconds = if d <= 60 { d / 10 * 10 } else { d / 30 * 30 };
        self.goal = self.goal.clamp(1, 20);
        self
    }

    fn interval(&self) -> Duration {
        Duration::from_secs(u64::from(self.interval_minutes) * 60)
    }

    fn planned_today(&self) -> bool {
        self.plan_day == today()
    }
}

/// Today's local date, "YYYY-MM-DD".
fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
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
// Migration from the old identifier (v0.1.0)
// ---------------------------------------------------------------------------

/// v0.1.0 shipped with this identifier. On macOS any folder ending in `.app` is shown as an
/// (unopenable) application, so v0.1.1 moved to `com.stretchreminder.desktop`.
const LEGACY_IDENTIFIER: &str = "com.stretchreminder.app";
const DATA_FILES: [&str; 2] = ["settings.json", "stats.json"];

/// Move settings/stats from the old identifier's folder to the new one, once.
/// Never loses data: the old files are only deleted after every copy succeeded, and if the
/// new folder already has settings (already migrated, or set up fresh) nothing is touched.
fn migrate_legacy_data(app: &AppHandle) {
    let Ok(new_dir) = app.path().app_config_dir() else { return };
    let Some(old_dir) = new_dir.parent().map(|p| p.join(LEGACY_IDENTIFIER)) else { return };
    if old_dir == new_dir || !old_dir.is_dir() {
        return;
    }

    if !new_dir.join("settings.json").exists() {
        if fs::create_dir_all(&new_dir).is_err() {
            return;
        }
        for name in DATA_FILES {
            let from = old_dir.join(name);
            if from.exists() && fs::copy(&from, new_dir.join(name)).is_err() {
                return; // keep the old data; try again next launch
            }
        }
    }

    // Copied (or already present in the new folder): remove the old files, then the folder
    // itself, but only if nothing else is left in it.
    for name in DATA_FILES {
        let _ = fs::remove_file(old_dir.join(name));
    }
    let _ = fs::remove_dir(&old_dir);

    remove_legacy_webview_caches(app);
}

/// macOS also kept webview caches under the old identifier (also `.app` folders).
/// They're regenerated under the new identifier, so the old ones can go.
#[cfg(target_os = "macos")]
fn remove_legacy_webview_caches(app: &AppHandle) {
    let Ok(home) = app.path().home_dir() else { return };
    for dir in [
        home.join("Library/Caches").join(LEGACY_IDENTIFIER),
        home.join("Library/WebKit").join(LEGACY_IDENTIFIER),
    ] {
        if dir.is_dir() {
            let _ = fs::remove_dir_all(dir);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn remove_legacy_webview_caches(_app: &AppHandle) {}

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

/// Counts for one local day ("YYYY-MM-DD"). Saved to stats.json. Mirrors `Stats` in src/shared.ts.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
struct Stats {
    day: String,
    completed: u32,
    missed: u32,
    /// Outcomes in order: 'c' = completed, 'm' = missed. Drives the circles in Details.
    events: String,
}

impl Stats {
    /// These stats if they're today's, otherwise an empty day.
    fn for_today(&self) -> Stats {
        let day = today();
        if self.day == day {
            self.clone()
        } else {
            Stats { day, ..Stats::default() }
        }
    }
}

fn stats_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("stats.json"))
}

fn load_stats(app: &AppHandle) -> Stats {
    stats_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

/// Update today's counts (starting fresh if the day changed), save them, and
/// return the updated stats.
fn record_stat(app: &AppHandle, update: impl FnOnce(&mut Stats)) -> Stats {
    let state = app.state::<AppState>();
    let mut stats = state.stats.lock().unwrap();
    *stats = stats.for_today();
    update(&mut stats);
    if let (Some(path), Ok(json)) = (stats_path(app), serde_json::to_string_pretty(&*stats)) {
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let _ = fs::write(path, json);
    }
    stats.clone()
}

/// A missed reminder comes back after this long instead of a full interval.
const MISSED_RETRY: Duration = Duration::from_secs(5 * 60);

impl AppState {
    /// Start the countdown only if none is running (first run, or today's plan was just
    /// confirmed). A running countdown is left alone, so a changed interval takes effect from
    /// the next stretch instead of resetting the current wait.
    fn start_timer_if_idle(&self) {
        if self.next_due.lock().unwrap().is_none() {
            self.restart_timer();
        }
    }

    /// Start a full interval, but only if today's plan has been confirmed.
    fn restart_timer(&self) {
        let settings = self.settings.lock().unwrap();
        *self.next_due.lock().unwrap() = settings
            .as_ref()
            .filter(|s| s.planned_today())
            .map(|s| Instant::now() + s.interval());
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
/// Saving always confirms today's plan (interval + goal). It starts reminders if they aren't
/// running yet; a countdown already in progress keeps going, and the new settings apply from
/// the next stretch.
fn save_settings(app: AppHandle, state: State<'_, AppState>, settings: Settings) -> Result<(), String> {
    let settings = Settings { plan_day: today(), ..settings }.sanitized();
    if settings.body_parts.is_empty() {
        return Err("Pick at least one body part to stretch.".into());
    }
    write_settings(&app, &settings)?;
    apply_tray_language(&app, settings.language);
    *state.settings.lock().unwrap() = Some(settings);
    state.start_timer_if_idle();
    Ok(())
}

#[tauri::command]
fn get_stats(state: State<'_, AppState>) -> Stats {
    state.stats.lock().unwrap().for_today()
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

/// The community site (downloads + review/report board).
/// If this ever changes, also update `plugins.updater.endpoints` in tauri.conf.json.
const COMMUNITY_URL: &str = "https://stretch-reminder-community.vercel.app";

/// Open the community site in the default browser, with the app version and OS so the
/// report form can pre-fill them. Only ever opens COMMUNITY_URL.
fn open_community_site(app: &AppHandle) {
    use tauri_plugin_opener::OpenerExt;
    let url = format!(
        "{COMMUNITY_URL}/?v={}&os={}",
        app.package_info().version,
        std::env::consts::OS
    );
    let _ = app.opener().open_url(url, None::<&str>);
}

#[tauri::command]
fn open_community(app: AppHandle) {
    open_community_site(&app);
}

/// The OS's primary language, for the first launch: "ko" if it's Korean, otherwise "en".
/// Read natively because the webview's `navigator.language` follows the app bundle's
/// localizations on macOS and can say "en-US" on a Korean system.
#[tauri::command]
fn system_language() -> Language {
    match sys_locale::get_locale() {
        Some(locale) if locale.to_lowercase().starts_with("ko") => Language::Ko,
        _ => Language::En,
    }
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

/// The page verified every part was stretched. Reaching today's goal ends the
/// day: the toast slides away and the app quits.
#[tauri::command]
async fn complete_stretch(app: AppHandle) {
    let stats = record_stat(&app, |s| {
        s.completed += 1;
        s.events.push('c');
    });
    let state = app.state::<AppState>();
    let goal = state.settings.lock().unwrap().as_ref().map_or(u32::MAX, |s| s.goal);
    let goal_reached = stats.completed >= goal;
    if !goal_reached {
        state.restart_timer();
    }
    slide_out_toast(&app, goal_reached);
}

/// The notification timed out before the user started stretching.
#[tauri::command]
async fn dismiss_toast(app: AppHandle) {
    record_stat(&app, |s| {
        s.missed += 1;
        s.events.push('m');
    });
    let state = app.state::<AppState>();
    *state.next_due.lock().unwrap() = Some(Instant::now() + MISSED_RETRY);
    slide_out_toast(&app, false);
}

fn slide_out_toast(app: &AppHandle, then_quit: bool) {
    let Some(win) = app.get_webview_window(TOAST) else {
        app.state::<AppState>().toast_open.store(false, Ordering::SeqCst);
        if then_quit {
            app.exit(0);
        }
        return;
    };
    let handle = app.clone();
    let done = {
        let win = win.clone();
        move || {
            let _ = win.destroy();
            handle.state::<AppState>().toast_open.store(false, Ordering::SeqCst);
            if then_quit {
                handle.exit(0);
            }
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
    if !settings.planned_today() {
        show_main(app); // ask for today's interval + goal first
        return Err("Set today's plan first.".into());
    }

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

    let w = (TOAST_WIDTH * scale).round() as i32;
    let h = (TOAST_HEIGHT * scale).round() as i32;
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
        .inner_size(TOAST_WIDTH, TOAST_HEIGHT)
        .position(f64::from(start_x) / scale, f64::from(y) / scale)
        // Transparent + no OS shadow, so the page can draw a rounded card.
        .transparent(true)
        .shadow(false)
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
        // A new day started while the app was running: pause and ask for today's plan.
        let stale_plan = state
            .settings
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|s| !s.planned_today());
        if stale_plan {
            if state.next_due.lock().unwrap().take().is_some() {
                show_main(&app);
            }
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

/// Tray menu items, kept so their labels can follow the language setting.
struct TrayMenu {
    stretch: MenuItem<Wry>,
    settings: MenuItem<Wry>,
    community: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

fn apply_tray_language(app: &AppHandle, language: Language) {
    let (stretch, settings, community, quit, tooltip) = match language {
        Language::En => (
            "Stretch now",
            "Settings…",
            "Community / Report a problem",
            "Quit Stretch Reminder",
            "Stretch Reminder",
        ),
        Language::Ko => ("지금 스트레칭", "설정…", "커뮤니티 · 문의하기", "스트레칭 알리미 종료", "스트레칭 알리미"),
    };
    if let Some(menu) = app.try_state::<TrayMenu>() {
        let _ = menu.stretch.set_text(stretch);
        let _ = menu.settings.set_text(settings);
        let _ = menu.community.set_text(community);
        let _ = menu.quit.set_text(quit);
    }
    if let Some(tray) = app.tray_by_id("tray") {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let stretch = MenuItem::with_id(app, "stretch", "Stretch now", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let community = MenuItem::with_id(app, "community", "Community / Report a problem", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Stretch Reminder", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&stretch, &settings, &community, &separator, &quit])?;
    app.manage(TrayMenu { stretch, settings, community, quit });

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
            "community" => open_community_site(app),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;

    let language = app
        .state::<AppState>()
        .settings
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.language)
        .unwrap_or_default();
    apply_tray_language(app.handle(), language);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build()) // in-app updates (signed, from the community site)
        .plugin(tauri_plugin_process::init()) // restart after an update
        .plugin(tauri_plugin_opener::init()) // open the community site in the browser
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_stats,
            hide_main,
            open_main,
            quit_app,
            open_community,
            system_language,
            seconds_until_next,
            stretch_now,
            toast_ready,
            nudge_toast,
            complete_stretch,
            dismiss_toast,
        ])
        .setup(|app| {
            migrate_legacy_data(app.handle()); // must run before anything reads settings/stats
            let saved = load_settings(app.handle());
            app.manage(AppState {
                // Reminders wait until today's plan is confirmed.
                next_due: Mutex::new(
                    saved
                        .as_ref()
                        .filter(|s| s.planned_today())
                        .map(|s| Instant::now() + s.interval()),
                ),
                settings: Mutex::new(saved),
                toast_open: AtomicBool::new(false),
                toast_slide_in: Mutex::new(None),
                stats: Mutex::new(load_stats(app.handle())),
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
