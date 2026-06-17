use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use base64::Engine;
use std::collections::HashMap;
use std::f64::consts::PI;

const MAX_DECO_SOURCE_TEXT_BYTES: usize = 1_000_000;
const MAX_DECO_SOURCE_DATA_CHARS: usize = 3_000_000;
const MAX_DECO_IMAGE_SIDE: u32 = 4096;
const MAX_DECO_IMAGE_PIXELS: u64 = 16_777_216;

#[derive(Serialize)]
struct ApiOk<T: Serialize> {
    ok: bool,
    payload: T,
}

#[derive(Serialize)]
struct ApiErr {
    ok: bool,
    message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum FloorMode {
    Enclave,
    Pose,
}

impl Default for FloorMode {
    fn default() -> Self {
        Self::Enclave
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum RidgeMode {
    Left,
    Right,
    Miter,
}

impl Default for RidgeMode {
    fn default() -> Self {
        Self::Left
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
enum DoorMode {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "round")]
    Round,
    #[serde(rename = "square")]
    Square,
    #[serde(rename = "pentagon")]
    Pentagon,
}

impl Default for DoorMode {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
struct DecorSettings {
    enabled: bool,
    #[serde(rename = "sourceType", alias = "source_type")]
    source_type: String,
    #[serde(rename = "sourceText", alias = "source_text")]
    source_text: String,
    #[serde(rename = "sourceData", alias = "source_data")]
    source_data: String,
    mode: String,
    w: f64,
    h: f64,
    #[serde(rename = "posX", alias = "pos_x")]
    pos_x: f64,
    #[serde(rename = "posY", alias = "pos_y")]
    pos_y: f64,
    rotation: f64,
    depth: f64,
    bevel: f64,
    smooth: f64,
    threshold: f64,
    invert: bool,
    resolution: f64,
    #[serde(rename = "removeBg", alias = "remove_bg")]
    remove_bg: bool,
    #[serde(rename = "clipToPanel", alias = "clip_to_panel")]
    clip_to_panel: bool,
}

impl Default for DecorSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            source_type: String::new(),
            source_text: String::new(),
            source_data: String::new(),
            mode: "heightmap".to_string(),
            w: 60.0,
            h: 60.0,
            pos_x: 50.0,
            pos_y: 50.0,
            rotation: 0.0,
            depth: 2.0,
            bevel: 0.0,
            smooth: 25.0,
            threshold: 2.0,
            invert: false,
            resolution: 64.0,
            remove_bg: false,
            clip_to_panel: true,
        }
    }
}

fn default_decos() -> HashMap<String, DecorSettings> {
    ["front", "back", "left", "right", "roofL", "roofR"]
        .into_iter()
        .map(|key| (key.to_string(), DecorSettings::default()))
        .collect()
}

fn default_panel_preset() -> String {
    "auto".to_string()
}

fn default_thickness_preset() -> String {
    "12".to_string()
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
struct NichoirParams {
    #[serde(rename = "W", alias = "w")]
    w: f64,
    #[serde(rename = "H", alias = "h")]
    h: f64,
    #[serde(rename = "D", alias = "d")]
    d: f64,
    #[serde(rename = "slope")]
    slope: f64,
    #[serde(rename = "overhang")]
    overhang: f64,
    #[serde(rename = "T", alias = "t")]
    t: f64,
    #[serde(rename = "thicknessPreset", alias = "thickness_preset", default = "default_thickness_preset")]
    thickness_preset: String,
    #[serde(rename = "unit")]
    unit: String,
    #[serde(rename = "lang")]
    lang: String,
    #[serde(rename = "mode")]
    mode: String,
    #[serde(rename = "explode")]
    explode: f64,
    #[serde(rename = "floor")]
    floor: FloorMode,
    #[serde(rename = "ridge")]
    ridge: RidgeMode,
    #[serde(rename = "taperX")]
    taper_x: f64,
    #[serde(rename = "door")]
    door: DoorMode,
    #[serde(rename = "doorW", alias = "door_w")]
    door_w: f64,
    #[serde(rename = "doorH", alias = "door_h")]
    door_h: f64,
    #[serde(rename = "doorPX", alias = "door_px")]
    door_px: f64,
    #[serde(rename = "doorPY", alias = "door_py")]
    door_py: f64,
    #[serde(rename = "doorVar", alias = "door_var")]
    door_var: f64,
    #[serde(rename = "doorPanel", alias = "door_panel")]
    door_panel: bool,
    #[serde(rename = "doorFollowTaper", alias = "door_follow_taper")]
    door_follow_taper: bool,
    #[serde(rename = "perch")]
    perch: bool,
    #[serde(rename = "perchDiam", alias = "perch_diam")]
    perch_diam: f64,
    #[serde(rename = "perchLen", alias = "perch_len")]
    perch_len: f64,
    #[serde(rename = "perchOff", alias = "perch_off")]
    perch_off: f64,
    #[serde(rename = "panelW", alias = "panel_w")]
    panel_w: f64,
    #[serde(rename = "panelH", alias = "panel_h")]
    panel_h: f64,
    #[serde(rename = "panelPreset", alias = "panel_preset", default = "default_panel_preset")]
    panel_preset: String,
    #[serde(rename = "kerf", alias = "saw_kerf")]
    kerf: f64,
    #[serde(rename = "hangHoles", alias = "hang_holes")]
    hang_holes: bool,
    #[serde(rename = "hangFL", alias = "hang_fl")]
    hang_fl: bool,
    #[serde(rename = "hangFR", alias = "hang_fr")]
    hang_fr: bool,
    #[serde(rename = "hangBL", alias = "hang_bl")]
    hang_bl: bool,
    #[serde(rename = "hangBR", alias = "hang_br")]
    hang_br: bool,
    #[serde(rename = "hangDiam", alias = "hang_diam")]
    hang_diam: f64,
    #[serde(rename = "hangSideOffset", alias = "hang_side_offset")]
    hang_side_offset: f64,
    #[serde(rename = "hangEndOffset", alias = "hang_end_offset")]
    hang_end_offset: f64,
    #[serde(rename = "wallMount", alias = "wall_mount")]
    wall_mount: bool,
    #[serde(rename = "wallMountHoleDiam", alias = "wall_mount_hole_diam")]
    wall_mount_hole_diam: f64,
    #[serde(rename = "wallMountHoleSpacing", alias = "wall_mount_hole_spacing")]
    wall_mount_hole_spacing: f64,
    #[serde(rename = "wallMountY", alias = "wall_mount_y")]
    wall_mount_y: f64,
    #[serde(rename = "wallMountBlockW", alias = "wall_mount_block_w")]
    wall_mount_block_w: f64,
    #[serde(rename = "wallMountBlockH", alias = "wall_mount_block_h")]
    wall_mount_block_h: f64,
    #[serde(rename = "wallMountBlockDepth", alias = "wall_mount_block_depth")]
    wall_mount_block_depth: f64,
    #[serde(rename = "decorActive", alias = "decor_active")]
    decor_active: String,
    decos: HashMap<String, DecorSettings>,
}

impl Default for NichoirParams {
    fn default() -> Self {
        Self {
            w: 160.0,
            h: 220.0,
            d: 160.0,
            slope: 45.0,
            overhang: 30.0,
            t: 12.0,
            thickness_preset: "12".to_string(),
            unit: "mm".to_string(),
            lang: "fr".to_string(),
            mode: "solid".to_string(),
            explode: 0.0,
            floor: FloorMode::Enclave,
            ridge: RidgeMode::Left,
            taper_x: 0.0,
            door: DoorMode::Round,
            door_w: 38.0,
            door_h: 38.0,
            door_px: 50.0,
            door_py: 50.0,
            door_var: 100.0,
            door_panel: false,
            door_follow_taper: false,
            perch: false,
            perch_diam: 8.0,
            perch_len: 30.0,
            perch_off: 15.0,
            panel_w: 1220.0,
            panel_h: 2440.0,
            panel_preset: "auto".to_string(),
            kerf: 3.2,
            hang_holes: true,
            hang_fl: true,
            hang_fr: true,
            hang_bl: true,
            hang_br: true,
            hang_diam: 6.0,
            hang_side_offset: 16.0,
            hang_end_offset: 16.0,
            wall_mount: false,
            wall_mount_hole_diam: 6.0,
            wall_mount_hole_spacing: 60.0,
            wall_mount_y: 110.0,
            wall_mount_block_w: 100.0,
            wall_mount_block_h: 70.0,
            wall_mount_block_depth: 0.0,
            decor_active: "front".to_string(),
            decos: default_decos(),
        }
    }
}

fn clamp_finite(value: f64, min: f64, max: f64, fallback: f64) -> f64 {
    if value.is_finite() {
        value.clamp(min, max)
    } else {
        fallback
    }
}

fn allowed_string(value: &str, allowed: &[&str], fallback: &str) -> String {
    if allowed.contains(&value) {
        value.to_string()
    } else {
        fallback.to_string()
    }
}

fn svg_tag_name_allowed(name: &str) -> bool {
    matches!(
        name,
        "svg" | "g" | "path" | "rect" | "circle" | "ellipse" | "polygon" | "polyline" | "line"
            | "title" | "desc"
    )
}

fn svg_attr_name_allowed(name: &str) -> bool {
    name == "xmlns"
        || name == "xmlns:xlink"
        || matches!(
            name,
            "id" | "class"
                | "version"
                | "viewbox"
                | "width"
                | "height"
                | "x"
                | "y"
                | "d"
                | "points"
                | "cx"
                | "cy"
                | "r"
                | "rx"
                | "ry"
                | "x1"
                | "y1"
                | "x2"
                | "y2"
                | "fill"
                | "fill-rule"
                | "fill-opacity"
                | "stroke"
                | "stroke-width"
                | "stroke-linecap"
                | "stroke-linejoin"
                | "stroke-miterlimit"
                | "stroke-opacity"
                | "opacity"
                | "transform"
                | "style"
        )
}

fn svg_tag_end(svg: &str, start: usize) -> Option<usize> {
    let bytes = svg.as_bytes();
    let mut quote = 0u8;
    let mut i = start + 1;
    while i < bytes.len() {
        let b = bytes[i];
        if quote != 0 {
            if b == quote {
                quote = 0;
            }
        } else if b == b'"' || b == b'\'' {
            quote = b;
        } else if b == b'>' {
            return Some(i);
        }
        i += 1;
    }
    None
}

fn svg_name_end(value: &str) -> usize {
    value
        .char_indices()
        .find_map(|(idx, ch)| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | ':') {
                None
            } else {
                Some(idx)
            }
        })
        .unwrap_or(value.len())
}

fn svg_attrs_look_safe(attrs: &str) -> bool {
    let mut rest = attrs.trim();
    while !rest.is_empty() {
        rest = rest.trim_start();
        if rest == "/" {
            return true;
        }
        if rest.starts_with('/') {
            rest = rest[1..].trim_start();
            continue;
        }

        let name_end = svg_name_end(rest);
        if name_end == 0 {
            return false;
        }
        let name = rest[..name_end].to_ascii_lowercase();
        if name.starts_with("on") || matches!(name.as_str(), "href" | "xlink:href" | "src") {
            return false;
        }
        if !svg_attr_name_allowed(&name) {
            return false;
        }
        rest = rest[name_end..].trim_start();
        if !rest.starts_with('=') {
            return false;
        }
        rest = rest[1..].trim_start();
        if rest.is_empty() {
            return false;
        }

        let (value, tail) = if let Some(quote) = rest
            .as_bytes()
            .first()
            .copied()
            .filter(|b| *b == b'"' || *b == b'\'')
        {
            let Some(end) = rest.as_bytes()[1..].iter().position(|b| *b == quote).map(|idx| idx + 1) else {
                return false;
            };
            (&rest[1..end], &rest[end + 1..])
        } else {
            let end = rest
                .char_indices()
                .find_map(|(idx, ch)| if ch.is_whitespace() || ch == '/' { Some(idx) } else { None })
                .unwrap_or(rest.len());
            (&rest[..end], &rest[end..])
        };
        let lower_value = value.to_ascii_lowercase();
        if lower_value.contains("javascript:")
            || lower_value.contains("@import")
            || lower_value.contains("url(")
            || lower_value.contains("expression(")
        {
            return false;
        }
        rest = tail;
    }
    true
}

fn svg_text_looks_safe(svg: &str) -> bool {
    if svg.trim().is_empty() || svg.len() > MAX_DECO_SOURCE_TEXT_BYTES {
        return false;
    }
    let lower = svg.to_lowercase();
    if lower.contains("<!doctype")
        || lower.contains("<!entity")
        || lower.contains("<?xml-stylesheet")
        || lower.contains("@import")
        || lower.contains("url(")
        || lower.contains("expression(")
        || lower.contains("<script")
        || lower.contains("<foreignobject")
        || lower.contains("<iframe")
        || lower.contains("<object")
        || lower.contains("<embed")
        || lower.contains("<audio")
        || lower.contains("<video")
    {
        return false;
    }

    let mut pos = 0usize;
    while let Some(rel_start) = svg[pos..].find('<') {
        let start = pos + rel_start;
        let Some(end) = svg_tag_end(svg, start) else {
            return false;
        };
        let tag = svg[start + 1..end].trim();
        if tag.is_empty() {
            return false;
        }
        if tag.starts_with("!--") {
            pos = end + 1;
            continue;
        }
        if tag.starts_with('!') {
            return false;
        }
        if tag.starts_with('?') {
            if !tag.to_ascii_lowercase().starts_with("?xml") {
                return false;
            }
            pos = end + 1;
            continue;
        }

        let is_closing = tag.starts_with('/');
        let tag_body = tag.trim_start_matches('/').trim_start();
        let name_end = svg_name_end(tag_body);
        if name_end == 0 {
            return false;
        }
        let name = tag_body[..name_end].to_ascii_lowercase();
        if !svg_tag_name_allowed(&name) {
            return false;
        }
        if !is_closing && !svg_attrs_look_safe(&tag_body[name_end..]) {
            return false;
        }
        pos = end + 1;
    }
    true
}

fn sanitize_decor(mut d: DecorSettings) -> DecorSettings {
    let defaults = DecorSettings::default();
    d.source_type = allowed_string(
        d.source_type.trim(),
        &["", "svg", "png", "jpg", "jpeg", "gif", "webp"],
        "",
    );
    d.mode = allowed_string(d.mode.trim(), &["vector", "heightmap"], "heightmap");
    d.w = clamp_finite(d.w, 5.0, 400.0, defaults.w);
    d.h = clamp_finite(d.h, 5.0, 400.0, defaults.h);
    d.pos_x = clamp_finite(d.pos_x, 0.0, 100.0, defaults.pos_x);
    d.pos_y = clamp_finite(d.pos_y, 0.0, 100.0, defaults.pos_y);
    d.rotation = clamp_finite(d.rotation, 0.0, 360.0, defaults.rotation);
    d.depth = clamp_finite(d.depth, 0.2, 20.0, defaults.depth);
    d.bevel = clamp_finite(d.bevel, 0.0, 100.0, defaults.bevel);
    d.smooth = clamp_finite(d.smooth, 0.0, 100.0, defaults.smooth);
    d.threshold = clamp_finite(d.threshold, 0.0, 60.0, defaults.threshold);
    d.resolution = clamp_finite(d.resolution, 8.0, 256.0, defaults.resolution);

    if d.source_type == "svg" {
        if !svg_text_looks_safe(&d.source_text) {
            d.enabled = false;
            d.source_type.clear();
            d.source_text.clear();
            d.source_data.clear();
            d.mode = "heightmap".to_string();
            return d;
        }
    } else {
        d.source_text.clear();
    }

    if d.source_data.len() > MAX_DECO_SOURCE_DATA_CHARS {
        d.source_data.clear();
        if d.mode == "heightmap" && d.source_type != "svg" {
            d.enabled = false;
            d.source_type.clear();
        }
    }

    if d.source_type.is_empty() && d.source_data.trim().is_empty() && d.source_text.trim().is_empty() {
        d.enabled = false;
    }

    d
}

fn sanitize_params(mut p: NichoirParams) -> NichoirParams {
    let defaults = NichoirParams::default();
    p.w = clamp_finite(p.w, 80.0, 400.0, defaults.w);
    p.h = clamp_finite(p.h, 80.0, 500.0, defaults.h);
    p.d = clamp_finite(p.d, 80.0, 400.0, defaults.d);
    p.slope = clamp_finite(p.slope, 10.0, 60.0, defaults.slope);
    p.overhang = clamp_finite(p.overhang, 0.0, 80.0, defaults.overhang);
    p.t = clamp_finite(p.t, 3.0, 25.0, defaults.t);
    p.taper_x = clamp_finite(p.taper_x, -60.0, 60.0, defaults.taper_x);
    let min_bottom_w = (p.t * 2.0 + 1.0).min(p.w);
    p.taper_x = p.taper_x.max((min_bottom_w - p.w) / 2.0);
    p.explode = clamp_finite(p.explode, 0.0, 100.0, defaults.explode);
    p.door_w = clamp_finite(p.door_w, 15.0, 300.0, defaults.door_w);
    p.door_h = clamp_finite(p.door_h, 15.0, 400.0, defaults.door_h);
    p.door_px = clamp_finite(p.door_px, 10.0, 90.0, defaults.door_px);
    p.door_py = clamp_finite(p.door_py, 15.0, 85.0, defaults.door_py);
    p.door_var = clamp_finite(p.door_var, 85.0, 125.0, defaults.door_var);
    p.perch_diam = clamp_finite(p.perch_diam, 3.0, 20.0, defaults.perch_diam);
    p.perch_len = clamp_finite(p.perch_len, 10.0, 80.0, defaults.perch_len);
    p.perch_off = clamp_finite(p.perch_off, 5.0, 60.0, defaults.perch_off);
    p.panel_w = clamp_finite(p.panel_w, 400.0, 3200.0, defaults.panel_w);
    p.panel_h = clamp_finite(p.panel_h, 400.0, 3200.0, defaults.panel_h);
    p.kerf = clamp_finite(p.kerf, 0.0, 10.0, defaults.kerf);
    p.hang_diam = clamp_finite(p.hang_diam, 2.0, 30.0, defaults.hang_diam);
    p.hang_side_offset = clamp_finite(p.hang_side_offset, 2.0, 120.0, defaults.hang_side_offset);
    p.hang_end_offset = clamp_finite(p.hang_end_offset, 2.0, 120.0, defaults.hang_end_offset);
    p.wall_mount_hole_diam = clamp_finite(p.wall_mount_hole_diam, 3.0, 20.0, defaults.wall_mount_hole_diam);
    p.wall_mount_hole_spacing = clamp_finite(p.wall_mount_hole_spacing, 20.0, 220.0, defaults.wall_mount_hole_spacing);
    p.wall_mount_y = clamp_finite(p.wall_mount_y, 20.0, 440.0, defaults.wall_mount_y);
    p.wall_mount_block_w = clamp_finite(p.wall_mount_block_w, 40.0, 260.0, defaults.wall_mount_block_w);
    p.wall_mount_block_h = clamp_finite(p.wall_mount_block_h, 30.0, 220.0, defaults.wall_mount_block_h);
    p.wall_mount_block_depth = if p.wall_mount_block_depth.is_finite() && p.wall_mount_block_depth > 0.0 {
        clamp_finite(p.wall_mount_block_depth, 6.0, 80.0, p.overhang.max(6.0))
    } else {
        p.overhang.max(6.0).min(80.0)
    };
    p.unit = allowed_string(p.unit.trim(), &["mm", "cm", "in"], "mm");
    p.lang = allowed_string(p.lang.trim(), &["fr", "en"], "fr");
    p.mode = allowed_string(p.mode.trim(), &["solid", "wireframe", "xray", "edges"], "solid");
    p.panel_preset = if p.panel_preset == "auto"
        || p.panel_preset == "custom"
        || market_panel_presets().iter().any(|(label, _, _)| *label == p.panel_preset)
    {
        p.panel_preset
    } else {
        default_panel_preset()
    };
    p.thickness_preset = allowed_string(
        p.thickness_preset.trim(),
        &["custom", "3", "6", "9", "12", "15", "18", "19", "25"],
        "12",
    );
    if !deco_target_keys().contains(&p.decor_active.as_str()) {
        p.decor_active = defaults.decor_active;
    }

    let mut sanitized_decos = default_decos();
    for key in deco_target_keys() {
        if let Some(deco) = p.decos.remove(key) {
            sanitized_decos.insert(key.to_string(), sanitize_decor(deco));
        }
    }
    p.decos = sanitized_decos;
    p
}

#[derive(Serialize)]
struct UnitConversion {
    label: &'static str,
    factor: f64,
    decimals: u32,
}

fn unit_def(unit: &str) -> UnitConversion {
    match unit {
        "cm" => UnitConversion {
            label: "cm",
            factor: 10.0,
            decimals: 1,
        },
        "in" => UnitConversion {
            label: "\"",
            factor: 25.4,
            decimals: 2,
        },
        _ => UnitConversion {
            label: "mm",
            factor: 1.0,
            decimals: 0,
        },
    }
}

fn to_display(mm: f64, unit: &str) -> f64 {
    let u = unit_def(unit);
    mm / u.factor
}

fn to_display_area(mm2: f64, unit: &str) -> f64 {
    let u = unit_def(unit);
    mm2 / (u.factor * u.factor)
}

fn to_display_volume(mm3: f64, unit: &str) -> f64 {
    let u = unit_def(unit);
    mm3 / (u.factor * u.factor * u.factor)
}

fn unit_area_label(unit: &str) -> &'static str {
    match unit {
        "cm" => "cm²",
        "in" => "in²",
        _ => "mm²",
    }
}

fn unit_volume_label(unit: &str) -> &'static str {
    match unit {
        "cm" => "cm³",
        "in" => "in³",
        _ => "mm³",
    }
}

fn format_len(mm: f64, unit: &str) -> String {
    let u = unit_def(unit);
    format!("{:.*}", u.decimals as usize, to_display(mm, unit))
}

fn format_area(mm2: f64, unit: &str) -> String {
    let decimals = if unit == "mm" { 0 } else { 2 };
    format!("{:.*}", decimals, to_display_area(mm2, unit))
}

fn format_volume(mm3: f64, unit: &str) -> String {
    let decimals = if unit == "mm" { 0 } else { 2 };
    format!("{:.*}", decimals, to_display_volume(mm3, unit))
}

fn parse_input(input: &str) -> Result<NichoirParams, String> {
    serde_json::from_str(input)
        .map(sanitize_params)
        .map_err(|e| format!("Invalid JSON: {e}"))
}

fn ok_json<T: Serialize>(payload: T) -> String {
    serde_json::to_string(&ApiOk {
        ok: true,
        payload,
    })
    .unwrap_or_else(|_| "{\"ok\":false,\"message\":\"Serialization failed\"}".to_string())
}

fn err_json(msg: &str) -> String {
    serde_json::to_string(&ApiErr {
        ok: false,
        message: msg.to_string(),
    })
    .unwrap_or_else(|_| "{\"ok\":false,\"message\":\"Serialization failed\"}".to_string())
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn t(lang: &str, key: &str) -> &'static str {
    match (lang, key) {
        ("en", "app_title") => "Calculator",
        ("en", "body") => "Body",
        ("en", "view") => "View",
        ("en", "decor") => "Decor",
        ("en", "calcs") => "Calcs",
        ("en", "cut_plan") => "Cut plan",
        ("en", "account") => "Account",
        ("en", "back_to_site") => "Site",
        ("en", "exports") => "Exports",
        ("en", "view_mode") => "View mode",
        ("en", "explode") => "Explode",
        ("en", "solid") => "Solid",
        ("en", "wireframe") => "Wire",
        ("en", "xray") => "X-ray",
        ("en", "edges") => "Edges",
        ("en", "width") => "Width",
        ("en", "height") => "Height",
        ("en", "depth") => "Depth",
        ("en", "taper") => "Taper X",
        ("en", "floor") => "Floor assembly",
        ("en", "roof") => "Roof",
        ("en", "slope") => "Roof slope",
        ("en", "overhang") => "Rain overhang",
        ("en", "ridge") => "Roof ridge",
        ("en", "ridge_auto_miter") => "Auto miter: left/right overlap is only flush at 45°.",
        ("en", "hang_holes") => "Suspension boring holes",
        ("en", "hang_enable") => "Enable roof suspension holes",
        ("en", "hang_front_left") => "Front L",
        ("en", "hang_front_right") => "Front R",
        ("en", "hang_back_left") => "Back L",
        ("en", "hang_back_right") => "Back R",
        ("en", "hang_diam") => "Hole diameter",
        ("en", "hang_side_offset") => "Offset from roof side edge",
        ("en", "hang_end_offset") => "Offset from front/back edge",
        ("en", "wall_mount") => "Wall mount",
        ("en", "wall_mount_enable") => "Enable rear wall mount",
        ("en", "wall_mount_hole_diam") => "Rear hole diameter",
        ("en", "wall_mount_hole_spacing") => "Hole spacing",
        ("en", "wall_mount_y") => "Hole height",
        ("en", "wall_mount_block_w") => "Mount block width",
        ("en", "wall_mount_block_h") => "Mount block height",
        ("en", "wall_mount_block_depth") => "Mount block depth",
        ("en", "wall_mount_note") => "Two rear holes align with the external block. Fasten it from inside through the entrance door. The block top sheds rain outward at 30 degrees.",
        ("en", "wall_mount_piece") => "Wall mount block",
        ("en", "wall_mount_note_cut") => "rear holes aligned to block",
        ("en", "models_3d_info") => "Fabrication geometry: STL files for the assembled house and individual printable parts.",
        ("en", "plans_info") => "Cut and assembly drawings: SVG, PNG and PDF files generated from the current dimensions.",
        ("en", "downloads") => "Downloads",
        ("en", "downloads_note") => "Download the files generated from the current model. 3D models are STL or ZIP; plans are SVG, PNG or PDF.",
        ("en", "download_models_3d") => "3D model downloads",
        ("en", "download_plans") => "Plan downloads",
        ("en", "material") => "Material",
        ("en", "thickness") => "Wall thickness",
        ("en", "thickness_preset") => "Market board thickness",
        ("en", "custom_stl_free") => "Custom / free STL",
        ("en", "thickness_note") => "This thickness drives STL wall thickness and cut-plan bevel dimensions. For fabrication, choose the real board thickness available on the market.",
        ("en", "door") => "Entrance door",
        ("en", "door_width") => "Door width",
        ("en", "door_height") => "Door height",
        ("en", "door_x") => "Horizontal position",
        ("en", "door_y") => "Vertical position",
        ("en", "door_panel") => "Create door panel",
        ("en", "door_var") => "Door panel fit",
        ("en", "door_follow_taper") => "Door sides follow taper",
        ("en", "perch") => "Add perch",
        ("en", "perch_diam") => "Perch diameter",
        ("en", "perch_len") => "Perch length",
        ("en", "perch_off") => "Below door",
        ("en", "panel") => "Sheet",
        ("en", "panel_preset") => "Market sheet",
        ("en", "panel_width") => "Sheet width",
        ("en", "panel_height") => "Sheet height",
        ("en", "kerf") => "Saw blade / kerf",
        ("en", "roof_pitch") => "Roof pitch",
        ("en", "side_angle") => "Side wall angle",
        ("en", "side_inset") => "Side inset",
        ("en", "side_roof_cut") => "Side roof bevel",
        ("en", "ridge_bevel") => "Ridge bevel",
        ("en", "floor_bevel") => "Floor bevel angle",
        ("en", "floor_side_cut") => "Floor side removal",
        ("en", "reset_view") => "Reset view",
        ("en", "volume_ext") => "Exterior volume",
        ("en", "volume_int") => "Interior volume",
        ("en", "material_volume") => "Material",
        ("en", "total_area") => "Total area",
        ("en", "pieces") => "Pieces",
        ("en", "export_house") => "Export house STL",
        ("en", "export_door") => "Export door STL",
        ("en", "export_panels") => "Export panel ZIP",
        ("en", "export_plan") => "Export plan SVG",
        ("en", "export_obj") => "Export debug OBJ",
        ("en", "mesh_report") => "Mesh report",
        ("en", "panel_stls") => "Panel STLs",
        ("en", "deco_target") => "Target panel",
        ("en", "deco_no_file") => "No relief image loaded",
        ("en", "deco_svg_loaded") => "SVG usable",
        ("en", "deco_svg_empty") => "SVG loaded, but no usable filled vector shape was found. Convert text/strokes to paths or use a filled SVG.",
        ("en", "deco_heightmap_loaded") => "Heightmap image loaded for WASM relief",
        ("en", "deco_enable") => "Relief active",
        ("en", "deco_load_svg") => "Load image",
        ("en", "deco_replace_image") => "Replace",
        ("en", "deco_clear") => "Clear",
        ("en", "deco_mode") => "Render mode",
        ("en", "deco_upload_title") => "Drop an image here",
        ("en", "deco_upload_body") => "SVG or browser-supported image, max 2 MB. Every file is converted to a WASM heightmap.",
        ("en", "deco_preview_empty") => "Preview after upload",
        ("en", "deco_relief_settings") => "Relief settings",
        ("en", "deco_heightmap_note") => "Light pixels rise, dark pixels stay low. Use invert if your source image has the relief backwards.",
        ("en", "deco_rotation") => "Image rotation",
        ("en", "deco_depth") => "Relief depth",
        ("en", "deco_invert") => "Invert heightmap",
        ("en", "deco_remove_bg") => "Transparent background / remove white background",
        ("en", "deco_resolution") => "Heightmap resolution",
        ("en", "deco_smooth") => "Auto smooth",
        ("en", "deco_bevel") => "Bevel / chamfer intensity",
        ("en", "deco_threshold") => "Noise threshold",
        ("en", "deco_clip") => "Clip relief to panel shape",
        ("en", "language") => "Language",
        ("en", "app_subtitle") => "BIRDHOUSE CALCULATOR",
        ("en", "dim_tab") => "DIM.",
        ("en", "floor_enclave") => "Inset",
        ("en", "floor_pose") => "Overlay",
        ("en", "floor_enclave_short") => "INSET",
        ("en", "floor_pose_short") => "OVERLAY",
        ("en", "ridge_left") => "Left",
        ("en", "ridge_right") => "Right",
        ("en", "ridge_miter") => "Miter",
        ("en", "door_none") => "None",
        ("en", "door_round") => "Round",
        ("en", "door_square") => "Square",
        ("en", "door_pentagon") => "Pent.",
        ("en", "vector") => "Vector",
        ("en", "heightmap") => "Heightmap",
        ("en", "choose_file_to_show_shape_settings") => "Load an image to show relief settings.",
        ("en", "download_calcs_pdf") => "Download calculations PDF",
        ("en", "models_3d") => "3D models",
        ("en", "house") => "House",
        ("en", "plans") => "Plans",
        ("en", "plan") => "Plan",
        ("en", "explosion") => "Exploded view",
        ("en", "diagnostic") => "Diagnostics",
        ("en", "debug") => "Debug",
        ("en", "report") => "Report",
        ("en", "panel_selected") => "Selected sheet",
        ("en", "format_used") => "Used format",
        ("en", "usage") => "Usage",
        ("en", "area_pieces") => "Piece area",
        ("en", "area_panel") => "Sheet area",
        ("en", "auto_smallest_panel") => "Auto - smallest compatible sheet",
        ("en", "login") => "Login",
        ("en", "logout_short") => "Logout",
        ("en", "plan_none") => "None",
        ("en", "credits_three") => "3 credits",
        ("en", "credits_two") => "2 credits",
        ("en", "credits_five") => "5 credits",
        ("en", "credit_one") => "1 credit",
        ("en", "facade_piece") => "Facade",
        ("en", "side_piece") => "Side",
        ("en", "floor_piece") => "Floor",
        ("en", "roof_piece") => "Roof",
        ("en", "left_short") => "L",
        ("en", "right_short") => "R",
        ("en", "account_balance") => "Credit balance",
        ("en", "server_source") => "server source",
        ("en", "account_state") => "Status",
        ("en", "account_email") => "Email",
        ("en", "account_plan") => "Plan",
        ("en", "app_summary_only") => "Summary only in app",
        ("en", "account_server_master") => "The PHP server remains the source of truth for account, credits, subscriptions, tickets, and payments.",
        ("en", "auth") => "Authentication",
        ("en", "session_active") => "Session active. The server decides download authorizations.",
        ("en", "refresh") => "Refresh",
        ("en", "state") => "state",
        ("en", "logout") => "Logout",
        ("en", "available_credits") => "Available credits",
        ("en", "current_export_hold") => "Current export hold",
        ("en", "short_authorization") => "short authorization",
        ("en", "costs") => "Costs",
        ("en", "server_validated") => "Server validated",
        ("en", "server_cost_policy") => "Cost confirmed by PHP before each download",
        ("en", "offers") => "Offers",
        ("en", "site") => "site",
        ("en", "info") => "info",
        ("en", "account_management") => "Account management",
        ("en", "account_backend_note") => "Profile, credits, subscription, and invoices stay on the PHP site. Quick tickets can also be followed here.",
        ("en", "pricing") => "Pricing",
        ("en", "support_tickets") => "Support tickets",
        ("en", "subject") => "Subject",
        ("en", "ticket_subject_placeholder") => "Question about an export",
        ("en", "message") => "Message",
        ("en", "ticket_message_placeholder") => "Describe the issue",
        ("en", "create_ticket") => "Create ticket",
        ("en", "no_ticket_loaded") => "No ticket loaded.",
        ("en", "ticket") => "Ticket",
        ("en", "close") => "Close",
        ("en", "reply") => "Reply",
        ("en", "reply_label") => "Reply",
        ("en", "export_consumption") => "Export consumption",
        ("en", "house_or_door_stl") => "STL exports",
        ("en", "plan_pdf_or_calcs_pdf") => "PDF exports",
        ("en", "panels_zip") => "Panel ZIP exports",
        ("en", "plan_svg_or_png") => "SVG / PNG exports",
        ("en", "user_management") => "User management",
        ("en", "account_backend_source") => "Account, credits, subscription, tickets, and payments come from the PHP backend.",
        ("en", "close_account") => "Close",
        ("en", "close_account_aria") => "Close account",
        ("en", "viewer_controls_aria") => "View controls",
        ("en", "viewer_preview_aria") => "3D preview",
        ("en", "axis_width") => "width",
        ("en", "axis_height") => "height",
        ("en", "axis_depth") => "depth",
        ("en", "shape_count") => "shape(s)",
        ("en", "straight_cut") => "straight cut",
        ("en", "no_special_angle") => "no special angle",
        ("en", "side_straight") => "straight",
        ("en", "angle") => "angle",
        ("en", "inset") => "inset",
        ("en", "upper_cut") => "top cut",
        ("en", "full_overlay") => "full overlay",
        ("en", "beveled_edges") => "beveled edges",
        ("en", "bottom_face") => "bottom",
        ("en", "top_face") => "top",
        ("en", "remove_each_side") => "remove on each side",
        ("en", "ridge_bevel_with_angle") => "ridge bevel",
        ("en", "ridge_overlap_no_bevel") => "overlaps ridge, no bevel",
        ("en", "under_overlap_straight_cut") => "under overlap, straight cut",
        ("en", "same_size_as_hole") => "same size as hole",
        ("en", "smaller_fits_hole") => "smaller (fits inside hole)",
        ("en", "larger_overlays_hole") => "larger (sits over hole)",
        ("en", "round_shape") => "round",
        ("en", "square_shape") => "square",
        ("en", "pentagon_shape") => "pent.",
        ("en", "selected_panel_fallback") => "Custom manual (auto unavailable)",
        ("en", "custom_manual") => "Custom / manual",
        ("en", "plan_preview_title") => "Nichoir cut plan",
        ("en", "panel_line") => "Sheet",
        ("en", "theme_light") => "Light",
        ("en", "gable_profile") => "gable profile",
        ("en", "flared_trapezoid") => "flared trapezoid",
        ("en", "narrowed_trapezoid") => "narrowed trapezoid",
        ("en", "flared_short") => "flared",
        ("en", "narrowed_short") => "narrowed",
        ("en", "beveled_shape") => "beveled",
        ("en", "solid_shape") => "solid",
        ("en", "inset_shape") => "inset",
        ("en", "cylinder") => "cylinder",
        ("en", "longitudinal_axis") => "longitudinal axis",
        (_, "app_title") => "Calculateur",
        (_, "body") => "Corps",
        (_, "view") => "Vue",
        (_, "decor") => "Decor",
        (_, "calcs") => "Calculs",
        (_, "cut_plan") => "Plan",
        (_, "account") => "Compte",
        (_, "back_to_site") => "Site",
        (_, "exports") => "Exports",
        (_, "view_mode") => "Mode de vue",
        (_, "explode") => "Eclate",
        (_, "solid") => "Plein",
        (_, "wireframe") => "Fil",
        (_, "xray") => "Rayons X",
        (_, "edges") => "Aretes",
        (_, "width") => "Largeur",
        (_, "height") => "Hauteur",
        (_, "depth") => "Profondeur",
        (_, "taper") => "Evasement X",
        (_, "floor") => "Assemblage plancher",
        (_, "roof") => "Toiture",
        (_, "slope") => "Pente du toit",
        (_, "overhang") => "Debordement pluie",
        (_, "ridge") => "Jonction crete",
        (_, "ridge_auto_miter") => "Onglet automatique: gauche/droit est flush seulement a 45°.",
        (_, "hang_holes") => "Trous de suspension",
        (_, "hang_enable") => "Activer les trous dans le toit",
        (_, "hang_front_left") => "Avant G",
        (_, "hang_front_right") => "Avant D",
        (_, "hang_back_left") => "Arriere G",
        (_, "hang_back_right") => "Arriere D",
        (_, "hang_diam") => "Diametre trou",
        (_, "hang_side_offset") => "Retrait depuis cote du toit",
        (_, "hang_end_offset") => "Retrait depuis avant/arriere",
        (_, "wall_mount") => "Fixation murale",
        (_, "wall_mount_enable") => "Activer le bloc arriere",
        (_, "wall_mount_hole_diam") => "Diametre trous arriere",
        (_, "wall_mount_hole_spacing") => "Espacement des trous",
        (_, "wall_mount_y") => "Hauteur des trous",
        (_, "wall_mount_block_w") => "Largeur bloc",
        (_, "wall_mount_block_h") => "Hauteur bloc",
        (_, "wall_mount_block_depth") => "Profondeur bloc",
        (_, "wall_mount_note") => "Deux trous arriere s'alignent avec le bloc externe. Vissage depuis l'interieur par la porte. Le dessus du bloc evacue l'eau vers l'exterieur a 30 degres.",
        (_, "wall_mount_piece") => "Bloc fixation murale",
        (_, "wall_mount_note_cut") => "trous arriere alignes au bloc",
        (_, "models_3d_info") => "Geometrie de fabrication: fichiers STL pour la maison assemblee et les pieces imprimables separees.",
        (_, "plans_info") => "Plans de coupe et d'assemblage: fichiers SVG, PNG et PDF generes depuis les dimensions courantes.",
        (_, "downloads") => "Telechargements",
        (_, "downloads_note") => "Telecharge les fichiers generes depuis le modele courant. Les modeles 3D sont en STL ou ZIP; les plans sont en SVG, PNG ou PDF.",
        (_, "download_models_3d") => "Telechargements modeles 3D",
        (_, "download_plans") => "Telechargements plans",
        (_, "material") => "Materiau",
        (_, "thickness") => "Epaisseur parois",
        (_, "thickness_preset") => "Epaisseur panneau commercial",
        (_, "custom_stl_free") => "Custom / STL libre",
        (_, "thickness_note") => "Cette epaisseur pilote le STL, les angles et les dimensions du plan de coupe. Pour fabriquer en panneau, choisis l'epaisseur reelle disponible sur le marche.",
        (_, "door") => "Porte d'entree",
        (_, "door_width") => "Largeur porte",
        (_, "door_height") => "Hauteur porte",
        (_, "door_x") => "Position horiz.",
        (_, "door_y") => "Position vert.",
        (_, "door_panel") => "Creer le panneau de porte",
        (_, "door_var") => "Ajustement porte",
        (_, "door_follow_taper") => "Cotes de porte suivent l'evasement",
        (_, "perch") => "Ajouter un perchoir",
        (_, "perch_diam") => "Diametre perchoir",
        (_, "perch_len") => "Longueur perchoir",
        (_, "perch_off") => "Sous la porte",
        (_, "panel") => "Panneau",
        (_, "panel_preset") => "Panneau commercial",
        (_, "panel_width") => "Largeur panneau",
        (_, "panel_height") => "Hauteur panneau",
        (_, "kerf") => "Lame de scie / trait",
        (_, "roof_pitch") => "Pente du toit",
        (_, "side_angle") => "Angle parois",
        (_, "side_inset") => "Retrait lateral",
        (_, "side_roof_cut") => "Coupe haute cote",
        (_, "ridge_bevel") => "Biseau crete",
        (_, "floor_bevel") => "Angle plancher",
        (_, "floor_side_cut") => "Retrait plancher/cote",
        (_, "reset_view") => "Recentrer la vue",
        (_, "volume_ext") => "Volume externe",
        (_, "volume_int") => "Volume interieur",
        (_, "material_volume") => "Matiere",
        (_, "total_area") => "Surface totale",
        (_, "pieces") => "Pieces",
        (_, "export_house") => "Exporter maison STL",
        (_, "export_door") => "Exporter porte STL",
        (_, "export_panels") => "Exporter panneaux ZIP",
        (_, "export_plan") => "Exporter plan SVG",
        (_, "export_obj") => "Exporter OBJ debug",
        (_, "mesh_report") => "Rapport mesh/STL",
        (_, "panel_stls") => "Panneaux STL",
        (_, "deco_target") => "Panneau cible",
        (_, "deco_no_file") => "Aucune image de relief chargee",
        (_, "deco_svg_loaded") => "SVG utilisable",
        (_, "deco_svg_empty") => "SVG charge, mais aucune forme vectorielle pleine exploitable n'a ete trouvee. Convertis les textes/traits en chemins ou utilise un SVG rempli.",
        (_, "deco_heightmap_loaded") => "Image heightmap chargee pour le relief WASM",
        (_, "deco_enable") => "Relief actif",
        (_, "deco_load_svg") => "Charger image",
        (_, "deco_replace_image") => "Remplacer",
        (_, "deco_clear") => "Supprimer",
        (_, "deco_mode") => "Mode de rendu",
        (_, "deco_upload_title") => "Depose une image ici",
        (_, "deco_upload_body") => "SVG ou image prise en charge par le navigateur, max 2 Mo. Chaque fichier est converti en heightmap WASM.",
        (_, "deco_preview_empty") => "Apercu apres chargement",
        (_, "deco_relief_settings") => "Reglages du relief",
        (_, "deco_heightmap_note") => "Les pixels clairs montent, les pixels fonces restent bas. Utilise inverser si le relief sort a l envers.",
        (_, "deco_rotation") => "Rotation image",
        (_, "deco_depth") => "Profondeur relief",
        (_, "deco_invert") => "Inverser heightmap",
        (_, "deco_remove_bg") => "Fond transparent / supprimer fond blanc",
        (_, "deco_resolution") => "Resolution heightmap",
        (_, "deco_smooth") => "Auto smooth",
        (_, "deco_bevel") => "Intensite biseau / chanfrein",
        (_, "deco_threshold") => "Seuil anti-bruit",
        (_, "deco_clip") => "Clipper le relief au panneau",
        (_, "language") => "Langue",
        (_, "app_subtitle") => "CALCULATEUR MAISON D'OISEAU",
        (_, "dim_tab") => "DIM.",
        (_, "floor_enclave") => "Enclave",
        (_, "floor_pose") => "Pose",
        (_, "floor_enclave_short") => "ENCLAVE",
        (_, "floor_pose_short") => "POSE",
        (_, "ridge_left") => "Gauche",
        (_, "ridge_right") => "Droit",
        (_, "ridge_miter") => "Onglet",
        (_, "door_none") => "Aucune",
        (_, "door_round") => "Ronde",
        (_, "door_square") => "Carree",
        (_, "door_pentagon") => "Penta.",
        (_, "vector") => "Vectoriel",
        (_, "heightmap") => "Heightmap",
        (_, "choose_file_to_show_shape_settings") => "Charge une image pour afficher les reglages du relief.",
        (_, "download_calcs_pdf") => "Telecharger les calculs PDF",
        (_, "models_3d") => "Modeles 3D",
        (_, "house") => "Maison",
        (_, "plans") => "Plans",
        (_, "plan") => "Plan",
        (_, "explosion") => "Explosion",
        (_, "diagnostic") => "Diagnostic",
        (_, "debug") => "Debug",
        (_, "report") => "Rapport",
        (_, "panel_selected") => "Panneau choisi",
        (_, "format_used") => "Format utilise",
        (_, "usage") => "Utilisation",
        (_, "area_pieces") => "Aire pieces",
        (_, "area_panel") => "Aire panneau",
        (_, "auto_smallest_panel") => "Auto - plus petit panneau compatible",
        (_, "login") => "Connexion",
        (_, "logout_short") => "Sortie",
        (_, "plan_none") => "Aucun",
        (_, "credits_three") => "3 credits",
        (_, "credits_two") => "2 credits",
        (_, "credits_five") => "5 credits",
        (_, "credit_one") => "1 credit",
        (_, "facade_piece") => "Facade",
        (_, "side_piece") => "Cote",
        (_, "floor_piece") => "Plancher",
        (_, "roof_piece") => "Toit",
        (_, "left_short") => "G",
        (_, "right_short") => "D",
        (_, "account_balance") => "Solde credits",
        (_, "server_source") => "source serveur",
        (_, "account_state") => "Etat",
        (_, "account_email") => "Courriel",
        (_, "account_plan") => "Plan",
        (_, "app_summary_only") => "Resume dans l'app seulement",
        (_, "account_server_master") => "Le serveur PHP reste maitre du compte, des credits, abonnements, tickets et paiements.",
        (_, "auth") => "Identification",
        (_, "session_active") => "Session active. Le serveur decide les autorisations de telechargement.",
        (_, "refresh") => "Rafraichir",
        (_, "state") => "etat",
        (_, "logout") => "Sortir",
        (_, "available_credits") => "Credits disponibles",
        (_, "current_export_hold") => "Reserve export courant",
        (_, "short_authorization") => "autorisation courte",
        (_, "costs") => "Couts",
        (_, "server_validated") => "Valide serveur",
        (_, "server_cost_policy") => "Cout confirme par PHP avant chaque telechargement",
        (_, "offers") => "Offres",
        (_, "site") => "site",
        (_, "info") => "info",
        (_, "account_management") => "Gestion compte",
        (_, "account_backend_note") => "Profil, credits, abonnement et factures restent sur le site PHP. Les tickets rapides peuvent aussi etre suivis ici.",
        (_, "pricing") => "Tarifs",
        (_, "support_tickets") => "Tickets support",
        (_, "subject") => "Sujet",
        (_, "ticket_subject_placeholder") => "Question sur un export",
        (_, "message") => "Message",
        (_, "ticket_message_placeholder") => "Decris le probleme",
        (_, "create_ticket") => "Creer ticket",
        (_, "no_ticket_loaded") => "Aucun ticket charge.",
        (_, "ticket") => "Ticket",
        (_, "close") => "Fermer",
        (_, "reply") => "Repondre",
        (_, "reply_label") => "Reponse",
        (_, "export_consumption") => "Consommation exports",
        (_, "house_or_door_stl") => "Exports STL",
        (_, "plan_pdf_or_calcs_pdf") => "Exports PDF",
        (_, "panels_zip") => "Exports ZIP panneaux",
        (_, "plan_svg_or_png") => "Exports SVG / PNG",
        (_, "user_management") => "Gestion usager",
        (_, "account_backend_source") => "Compte, credits, abonnement, tickets et paiements viennent du backend PHP.",
        (_, "close_account") => "Fermer",
        (_, "close_account_aria") => "Fermer le compte",
        (_, "viewer_controls_aria") => "Controles de vue",
        (_, "viewer_preview_aria") => "Apercu 3D",
        (_, "axis_width") => "largeur",
        (_, "axis_height") => "hauteur",
        (_, "axis_depth") => "profondeur",
        (_, "shape_count") => "forme(s)",
        (_, "straight_cut") => "coupe droite",
        (_, "no_special_angle") => "aucun angle special",
        (_, "side_straight") => "droit",
        (_, "angle") => "angle",
        (_, "inset") => "retrait",
        (_, "upper_cut") => "coupe haute",
        (_, "full_overlay") => "pose pleine",
        (_, "beveled_edges") => "chants biseautes",
        (_, "bottom_face") => "dessous",
        (_, "top_face") => "dessus",
        (_, "remove_each_side") => "retirer par cote",
        (_, "ridge_bevel_with_angle") => "biseau crete",
        (_, "ridge_overlap_no_bevel") => "recouvre crete, sans biseau",
        (_, "under_overlap_straight_cut") => "sous recouvrement, coupe droite",
        (_, "same_size_as_hole") => "meme taille que trou",
        (_, "smaller_fits_hole") => "plus petite (rentre dans le trou)",
        (_, "larger_overlays_hole") => "plus grande (se pose par-dessus)",
        (_, "round_shape") => "ronde",
        (_, "square_shape") => "carree",
        (_, "pentagon_shape") => "penta.",
        (_, "selected_panel_fallback") => "Custom manuel (auto impossible)",
        (_, "custom_manual") => "Custom / manuel",
        (_, "plan_preview_title") => "Plan de coupe Nichoir",
        (_, "panel_line") => "Panneau",
        (_, "theme_light") => "Clair",
        (_, "gable_profile") => "profil pignon",
        (_, "flared_trapezoid") => "trapeze evase",
        (_, "narrowed_trapezoid") => "trapeze retreci",
        (_, "flared_short") => "evase",
        (_, "narrowed_short") => "retreci",
        (_, "beveled_shape") => "biseau",
        (_, "solid_shape") => "plein",
        (_, "inset_shape") => "enclave",
        (_, "cylinder") => "cylindre",
        (_, "longitudinal_axis") => "axe longitudinal",
        _ => "",
    }
}

fn taper_facade_note(p: &NichoirParams, lang: &str) -> String {
    if p.taper_x.abs() < 1e-9 {
        t(lang, "gable_profile").to_string()
    } else {
        let delta = format_len(p.taper_x.abs(), &p.unit);
        let label = if p.taper_x > 0.0 {
            t(lang, "flared_trapezoid")
        } else {
            t(lang, "narrowed_trapezoid")
        };
        format!("{label} ({delta} {})", unit_def(&p.unit).label)
    }
}

fn taper_side_note(p: &NichoirParams, lang: &str) -> String {
    if p.taper_x.abs() < 1e-9 {
        String::new()
    } else {
        let label = if p.taper_x > 0.0 {
            t(lang, "flared_short")
        } else {
            t(lang, "narrowed_short")
        };
        format!("{label} {} {}", format_len(p.taper_x.abs(), &p.unit), unit_def(&p.unit).label)
    }
}

fn piece_name(lang: &str, key: &str, suffix: Option<&str>) -> String {
    let base = match key {
        "facade" => t(lang, "facade_piece"),
        "side" => t(lang, "side_piece"),
        "floor" => t(lang, "floor_piece"),
        "roof" => t(lang, "roof_piece"),
        _ => key,
    };
    match suffix {
        Some(extra) if !extra.is_empty() => format!("{base} {extra}"),
        _ => base.to_string(),
    }
}

fn checked(v: bool) -> &'static str {
    if v { "checked" } else { "" }
}

fn active_str(current: &str, value: &str) -> &'static str {
    if current == value { "active" } else { "" }
}

fn door_value(door: DoorMode) -> &'static str {
    match door {
        DoorMode::None => "none",
        DoorMode::Round => "round",
        DoorMode::Square => "square",
        DoorMode::Pentagon => "pentagon",
    }
}

fn floor_value(floor: FloorMode) -> &'static str {
    match floor {
        FloorMode::Enclave => "enclave",
        FloorMode::Pose => "pose",
    }
}

fn ridge_value(ridge: RidgeMode) -> &'static str {
    match ridge {
        RidgeMode::Left => "left",
        RidgeMode::Right => "right",
        RidgeMode::Miter => "miter",
    }
}

fn effective_ridge(p: &NichoirParams) -> RidgeMode {
    if (p.slope - 45.0).abs() < 0.001 {
        p.ridge
    } else {
        RidgeMode::Miter
    }
}

fn range_control_scaled(label: &str, key: &str, min: f64, max: f64, step: f64, value: f64, _suffix: &str, scale: f64) -> String {
    let scale = scale.max(0.000001);
    let min_display = min / scale;
    let max_display = max / scale;
    let step_display = step / scale;
    let value_display = value / scale;
    format!(
        r#"<label class="range-control"><span>{}</span><span class="range-row"><input data-param="{}" data-param-scale="{:.6}" type="range" min="{:.3}" max="{:.3}" step="{:.3}" value="{:.3}"><span class="number-row"><input data-param-number="{}" data-param-scale="{:.6}" type="number" min="{:.3}" max="{:.3}" step="{:.3}" value="{:.3}"></span></span></label>"#,
        html_escape(label),
        html_escape(key),
        scale,
        min_display,
        max_display,
        step_display,
        value_display,
        html_escape(key),
        scale,
        min_display,
        max_display,
        step_display,
        value_display,
    )
}

fn range_control(label: &str, key: &str, min: f64, max: f64, step: f64, value: f64, suffix: &str) -> String {
    range_control_scaled(label, key, min, max, step, value, suffix, 1.0)
}

fn length_control(label: &str, key: &str, min_mm: f64, max_mm: f64, step_mm: f64, value_mm: f64, unit: &str) -> String {
    let u = unit_def(unit);
    range_control_scaled(label, key, min_mm, max_mm, step_mm, value_mm, u.label, u.factor)
}

fn deco_range_control(label: &str, key: &str, min: f64, max: f64, step: f64, value: f64, scale: f64) -> String {
    let scale = scale.max(0.000001);
    format!(
        r#"<label class="range-control"><span>{}</span><span class="range-row"><input data-deco-param="{}" data-deco-scale="{:.6}" type="range" min="{:.3}" max="{:.3}" step="{:.3}" value="{:.3}"><span class="number-row"><input data-deco-number="{}" data-deco-scale="{:.6}" type="number" min="{:.3}" max="{:.3}" step="{:.3}" value="{:.3}"></span></span></label>"#,
        html_escape(label),
        html_escape(key),
        scale,
        min / scale,
        max / scale,
        step / scale,
        value / scale,
        html_escape(key),
        scale,
        min / scale,
        max / scale,
        step / scale,
        value / scale,
    )
}

fn deco_length_control(label: &str, key: &str, min_mm: f64, max_mm: f64, step_mm: f64, value_mm: f64, unit: &str) -> String {
    let u = unit_def(unit);
    deco_range_control(label, key, min_mm, max_mm, step_mm, value_mm, u.factor)
}

fn choice_button(label: &str, key: &str, value: &str, current: &str) -> String {
    format!(
        r#"<button class="choice {}" data-choice="{}" data-value="{}">{}</button>"#,
        active_str(current, value),
        html_escape(key),
        html_escape(value),
        html_escape(label),
    )
}

fn icon_text(icon: &str, glyph_class: &str, label_class: &str, label: &str) -> String {
    format!(
        r#"<span class="{}" aria-hidden="true">{}</span><span class="{}">{}</span>"#,
        html_escape(glyph_class),
        html_escape(icon),
        html_escape(label_class),
        html_escape(label),
    )
}

fn info_tip(label: &str) -> String {
    format!(
        r#"<button class="group-info" type="button" title="{}" aria-label="{}"><span aria-hidden="true">i</span></button>"#,
        html_escape(label),
        html_escape(label),
    )
}

fn selected_panel_preset(p: &NichoirParams, value: &str) -> &'static str {
    if p.panel_preset == value {
        return "selected";
    }
    let mut parts = value.split('x');
    let w = parts.next().and_then(|x| x.parse::<f64>().ok()).unwrap_or(0.0);
    let h = parts.next().and_then(|x| x.parse::<f64>().ok()).unwrap_or(0.0);
    if (p.panel_w - w).abs() < 0.6 && (p.panel_h - h).abs() < 0.6 {
        "selected"
    } else {
        ""
    }
}

fn panel_preset_select(p: &NichoirParams, lang: &str) -> String {
    let presets: Vec<(&str, String)> = vec![
        ("auto", t(lang, "auto_smallest_panel").to_string()),
        ("custom", t(lang, "custom_manual").to_string()),
        ("1219.2x2438.4", "4 x 8 ft - 1219 x 2438 mm".to_string()),
        ("1219.2x1219.2", "4 x 4 ft - 1219 x 1219 mm".to_string()),
        ("609.6x1219.2", "2 x 4 ft - 610 x 1219 mm".to_string()),
        ("1524x1524", "5 x 5 ft - 1524 x 1524 mm".to_string()),
        ("1524x3048", "5 x 10 ft - 1524 x 3048 mm".to_string()),
        ("1220x2440", "1220 x 2440 mm".to_string()),
        ("1250x2500", "1250 x 2500 mm".to_string()),
        ("1500x3000", "1500 x 3000 mm".to_string()),
    ];
    let mut options = String::new();
    let mut matched = false;
    for (value, label) in presets {
        let selected = if value == "custom" || value == "auto" {
            if p.panel_preset == value {
                matched = true;
                "selected"
            } else {
                ""
            }
        } else if p.panel_preset == "auto" {
            ""
        } else {
            let s = selected_panel_preset(p, value);
            if !s.is_empty() {
                matched = true;
            }
            s
        };
        options.push_str(&format!(
            r#"<option value="{}" {}>{}</option>"#,
            html_escape(value),
            selected,
            html_escape(&label),
        ));
    }
    let custom_selected = if matched { "" } else { "selected" };
    options = options.replacen("<option value=\"custom\" >", &format!("<option value=\"custom\" {custom_selected}>"), 1);
    format!(
        r#"<label class="select-control"><span>{}</span><select data-panel-preset>{}</select></label>"#,
        html_escape(t(lang, "panel_preset")),
        options,
    )
}

fn selected_thickness_preset(p: &NichoirParams, value: &str) -> &'static str {
    if p.thickness_preset == value {
        return "selected";
    }
    let mm = value.parse::<f64>().unwrap_or(0.0);
    if mm > 0.0 && (p.t - mm).abs() < 0.05 {
        "selected"
    } else {
        ""
    }
}

fn thickness_preset_select(p: &NichoirParams, lang: &str) -> String {
    let presets = [
        ("custom", t(lang, "custom_stl_free")),
        ("3", "3 mm"),
        ("6", "6 mm"),
        ("9", "9 mm"),
        ("12", "12 mm"),
        ("15", "15 mm"),
        ("18", "18 mm"),
        ("6.35", "1/4 in - 6.35 mm"),
        ("9.525", "3/8 in - 9.53 mm"),
        ("12.7", "1/2 in - 12.7 mm"),
        ("15.875", "5/8 in - 15.88 mm"),
        ("19.05", "3/4 in - 19.05 mm"),
    ];
    let mut options = String::new();
    let mut matched = false;
    for (value, label) in presets {
        let selected = if value == "custom" {
            if p.thickness_preset == "custom" {
                matched = true;
                "selected"
            } else {
                ""
            }
        } else {
            let s = selected_thickness_preset(p, value);
            if !s.is_empty() {
                matched = true;
            }
            s
        };
        options.push_str(&format!(
            r#"<option value="{}" {}>{}</option>"#,
            html_escape(value),
            selected,
            html_escape(label),
        ));
    }
    if !matched {
        options = options.replacen("<option value=\"custom\" >", "<option value=\"custom\" selected>", 1);
    }
    format!(
        r#"<label class="select-control"><span>{}</span><select data-thickness-preset>{}</select></label>"#,
        html_escape(t(lang, "thickness_preset")),
        options,
    )
}

#[wasm_bindgen]
pub fn wasm_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[derive(Serialize, Clone)]
struct GeometryPayload {
    is_pose: bool,
    wall_h: f64,
    roof_h: f64,
    wall_h_real: f64,
    side_d: f64,
    floor_w: f64,
    floor_top_w: f64,
    floor_d: f64,
    s_l: f64,
    roof_len: f64,
    roof_l_left: f64,
    roof_l_right: f64,
    w_top: f64,
    w_bot: f64,
    wall_area_front: f64,
    wall_area_side: f64,
    bottom_area: f64,
    roof_area_total: f64,
    total_area: f64,
    ext_volume: f64,
    int_volume: f64,
    material_volume: f64,
    side_angle_deg: f64,
    side_inset: f64,
    roof_side_cut: f64,
    roof_ridge_cut: f64,
    floor_side_cut: f64,
    facade_note: String,
    side_note: String,
}

impl GeometryPayload {
    fn from_p(p: &NichoirParams) -> Self {
        let lang = p.lang.as_str();
        let ang = p.slope * PI / 180.0;
        let is_pose = matches!(p.floor, FloorMode::Pose);
        let ridge = effective_ridge(p);

        let wall_h = if is_pose { p.h - p.t } else { p.h }.max(0.0);
        let roof_h = (p.w / 2.0) * ang.tan();
        let s_l = (p.w / 2.0 + p.overhang) / ang.cos();
        let roof_len = p.d + 2.0 * p.overhang;
        let roof_side_left = match ridge {
            RidgeMode::Left => s_l + p.t,
            RidgeMode::Right => s_l,
            RidgeMode::Miter => s_l,
        };
        let roof_side_right = match ridge {
            RidgeMode::Right => s_l + p.t,
            RidgeMode::Left => s_l,
            RidgeMode::Miter => s_l,
        };

        let w_top = p.w;
        let w_bot = p.w + 2.0 * p.taper_x;
        let wall_alpha = (p.taper_x / wall_h.max(0.001)).atan();
        let side_inset = p.t / wall_alpha.cos().max(0.001);
        let side_angle_deg = wall_alpha * 180.0 / PI;
        let roof_side_cut = side_inset * ang.tan();
        let roof_ridge_cut = if matches!(ridge, RidgeMode::Miter) {
            p.t * ang.tan()
        } else {
            0.0
        };
        let wall_h_real = (wall_h * wall_h + p.taper_x * p.taper_x).sqrt();
        let floor_w = if is_pose { w_bot } else { (w_bot - 2.0 * side_inset).max(0.0) };
        let floor_side_cut = if is_pose {
            0.0
        } else {
            (p.taper_x * p.t / wall_h.max(0.001)).abs()
        };
        let floor_top_w = if is_pose {
            floor_w
        } else if p.taper_x >= 0.0 {
            (floor_w - 2.0 * floor_side_cut).max(0.0)
        } else {
            floor_w + 2.0 * floor_side_cut
        };
        let floor_d = if is_pose { p.d } else { (p.d - 2.0 * p.t).max(0.0) };
        let side_d = (p.d - 2.0 * p.t).max(0.0);

        let wall_prism = ((w_top + w_bot) / 2.0) * wall_h * p.d;
        let gable = p.w * p.d * roof_h * 0.5;
        let ext_volume = wall_prism + gable;

        let i_w = (p.w - 2.0 * p.t).max(0.0);
        let i_d = (p.d - 2.0 * p.t).max(0.0);
        let i_wall_h = if is_pose { wall_h } else { (wall_h - p.t).max(0.0) };
        let i_w_bot = i_w + 2.0 * p.taper_x;
        let i_wall_prism = ((i_w + i_w_bot) / 2.0) * i_wall_h * i_d;
        let i_roof_h = if i_w > 0.0 { (i_w / 2.0) * ang.tan() } else { 0.0 };
        let i_gable = (i_w * i_d * i_roof_h * 0.5).max(0.0);
        let int_volume = (i_wall_prism + i_gable).max(0.0);

        let front_area = ((w_top + w_bot) / 2.0) * wall_h + p.w * roof_h * 0.5;
        let side_area = side_d * wall_h_real;
        let bottom_area = floor_w * floor_d;
        let bevel = p.t * ang.tan();
        let roof_area_left = if matches!(ridge, RidgeMode::Miter) {
            (s_l + bevel * 0.5) * roof_len
        } else {
            roof_side_left * roof_len
        };
        let roof_area_right = if matches!(ridge, RidgeMode::Miter) {
            (s_l + bevel * 0.5) * roof_len
        } else {
            roof_side_right * roof_len
        };

        let roof_area_total = roof_area_left + roof_area_right;
        let total_area = 2.0 * front_area + 2.0 * side_area + bottom_area + roof_area_total;
        let material_volume = (ext_volume - int_volume).max(0.0);

        let facade_note = taper_facade_note(p, lang);
        let side_note = taper_side_note(p, lang);

        Self {
            is_pose,
            wall_h,
            roof_h,
            wall_h_real,
            side_d,
            floor_w,
            floor_top_w,
            floor_d,
            s_l,
            roof_len,
            roof_l_left: roof_side_left,
            roof_l_right: roof_side_right,
            w_top,
            w_bot,
            wall_area_front: front_area,
            wall_area_side: side_area,
            bottom_area,
            roof_area_total,
            total_area,
            ext_volume,
            int_volume,
            material_volume,
            side_angle_deg,
            side_inset,
            roof_side_cut,
            roof_ridge_cut,
            floor_side_cut,
            facade_note,
            side_note,
        }
    }
}

#[derive(Serialize)]
struct BomLine {
    name: String,
    kind: String,
    qty: u32,
    w: f64,
    h: f64,
    w_display: String,
    h_display: String,
    note: String,
}

#[derive(Serialize)]
struct StatsPayload {
    unit: String,
    geometry: GeometryPayload,
    cuts: Vec<BomLine>,
    piece_count: u32,
    unit_label: String,
    unit_area_label: String,
    unit_volume_label: String,
    roof_height_display: String,
    wall_thickness_display: String,
}

fn build_cuts(p: &NichoirParams, g: &GeometryPayload) -> Vec<BomLine> {
    let mut cuts = Vec::new();
    let unit = &p.unit;
    let lang = p.lang.as_str();
    let ridge = effective_ridge(p);
    let (roof_left_w, _) = poly_bounds(&roof_profile_points(p, g, true));
    let (roof_right_w, _) = poly_bounds(&roof_profile_points(p, g, false));

    let base_cut = |
name: &str, qty: u32, shape: &str, w: f64, h: f64, note: &str| BomLine {
        name: name.to_string(),
        kind: shape.to_string(),
        qty,
        w,
        h,
        w_display: format_len(w, unit),
        h_display: format_len(h, unit),
        note: note.to_string(),
    };

    cuts.push(base_cut(
        &piece_name(lang, "facade", None),
        2,
        "pent",
        g.w_bot.max(g.w_top),
        g.wall_h + g.roof_h,
        &g.facade_note,
    ));

    cuts.push(base_cut(
        &piece_name(lang, "side", None),
        2,
        t(lang, "beveled_shape"),
        g.side_d,
        g.wall_h_real + g.roof_side_cut,
        &format!(
            "{}; {} {:.1}°, {} {}, {} {}",
            if g.side_note.is_empty() { t(lang, "side_straight") } else { &g.side_note },
            t(lang, "angle"),
            g.side_angle_deg,
            t(lang, "inset"),
            format_len(g.side_inset, unit),
            t(lang, "upper_cut"),
            format_len(g.roof_side_cut, unit),
        ),
    ));

    let floor_blank_w = g.floor_w.max(g.floor_top_w);
    let floor_note = if matches!(p.floor, FloorMode::Pose) {
        t(lang, "full_overlay").to_string()
    } else {
        format!(
            "{} {:.1}°, {} {}, {} {}, {} {}",
            t(lang, "beveled_edges"),
            g.side_angle_deg.abs(),
            t(lang, "bottom_face"),
            format_len(g.floor_w, unit),
            t(lang, "top_face"),
            format_len(g.floor_top_w, unit),
            t(lang, "remove_each_side"),
            format_len(g.floor_side_cut, unit),
        )
    };
    cuts.push(base_cut(
        &piece_name(lang, "floor", None),
        1,
        if matches!(p.floor, FloorMode::Pose) {
            t(lang, "solid_shape")
        } else {
            t(lang, "inset_shape")
        },
        floor_blank_w,
        g.floor_d,
        &floor_note,
    ));

    if matches!(ridge, RidgeMode::Miter) {
        cuts.push(base_cut(
            &piece_name(lang, "roof", None),
            2,
            "rect",
            g.s_l,
            g.roof_len,
            &format!(
                "{} {}°, {} {}",
                t(lang, "ridge_bevel_with_angle"),
                p.slope,
                t(lang, "inset"),
                format_len(g.roof_ridge_cut, unit)
            ),
        ));
    } else {
        cuts.push(base_cut(
            &piece_name(lang, "roof", Some(t(lang, "left_short"))),
            1,
            "rect",
            roof_left_w,
            g.roof_len,
            if matches!(ridge, RidgeMode::Left) {
                t(lang, "ridge_overlap_no_bevel")
            } else {
                t(lang, "under_overlap_straight_cut")
            },
        ));
        cuts.push(base_cut(
            &piece_name(lang, "roof", Some(t(lang, "right_short"))),
            1,
            "rect",
            roof_right_w,
            g.roof_len,
            if matches!(ridge, RidgeMode::Right) {
                t(lang, "ridge_overlap_no_bevel")
            } else {
                t(lang, "under_overlap_straight_cut")
            },
        ));
    }

    if !matches!(p.door, DoorMode::None) && p.door_panel {
        let v = (p.door_var / 100.0).max(0.0);
        let shape_name = match p.door {
            DoorMode::Round => t(lang, "round_shape"),
            DoorMode::Square => t(lang, "square_shape"),
            DoorMode::Pentagon => t(lang, "pentagon_shape"),
            DoorMode::None => "",
        };
        let w = p.door_w * v;
        let h = p.door_h * v;
        let door_note = if (p.door_var - 100.0).abs() < f64::EPSILON {
            t(lang, "same_size_as_hole")
        } else if p.door_var < 100.0 {
            t(lang, "smaller_fits_hole")
        } else {
            t(lang, "larger_overlays_hole")
        };
        cuts.push(base_cut(
            t(lang, "door"),
            1,
            shape_name,
            w,
            h,
            door_note,
        ));
    }

    if p.perch && !matches!(p.door, DoorMode::None) {
        cuts.push(base_cut(
            t(lang, "perch"),
            1,
            t(lang, "cylinder"),
            p.perch_diam,
            p.perch_len,
            t(lang, "longitudinal_axis"),
        ));
    }

    if p.wall_mount {
        let m = wall_mount_geometry(p, g);
        cuts.push(base_cut(
            t(lang, "wall_mount_piece"),
            1,
            "rect",
            m.block_w,
            m.block_h,
            t(lang, "wall_mount_note_cut"),
        ));
    }

    cuts
}

#[wasm_bindgen]
pub fn compute_summary(input: &str) -> String {
    match parse_input(input) {
        Ok(p) => {
            let geom = GeometryPayload::from_p(&p);
            let cuts = build_cuts(&p, &geom);
            let roof_height_display = format!("{:.3} {}", to_display(geom.roof_h, &p.unit), unit_def(&p.unit).label);
            let wall_thickness_display = format!(
                "{:.3} {}",
                to_display(p.t, &p.unit),
                unit_def(&p.unit).label
            );
            let payload = StatsPayload {
                unit: p.unit.clone(),
                geometry: geom.clone(),
                cuts,
                piece_count: 7 + if !matches!(p.door, DoorMode::None) && p.door_panel { 1 } else { 0 } + if p.perch && !matches!(p.door, DoorMode::None) { 1 } else { 0 } + if p.wall_mount { 1 } else { 0 },
                unit_label: unit_def(&p.unit).label.to_string(),
                unit_area_label: unit_area_label(&p.unit).to_string(),
                unit_volume_label: unit_volume_label(&p.unit).to_string(),
                roof_height_display,
                wall_thickness_display,
            };
            ok_json(payload)
        }
        Err(err) => err_json(&err),
    }
}

#[wasm_bindgen]
pub fn compute_stats(input: &str) -> String {
    compute_summary(input)
}

#[derive(Serialize, Clone)]
struct LayoutPiece {
    name: String,
    qty: u32,
    w: f64,
    h: f64,
    color: String,
    shape: String,
    rot: bool,
    px: f64,
    py: f64,
    overflow: bool,
    wall_h: Option<f64>,
    roof_h: Option<f64>,
    w_top: Option<f64>,
    w_bot: Option<f64>,
}

#[derive(Serialize)]
struct CutLayoutPayload {
    panel_w: f64,
    panel_h: f64,
    panel_label: String,
    auto_panel: bool,
    gap: f64,
    total_area: f64,
    placed_area: f64,
    usage_ratio: f64,
    pieces: Vec<LayoutPiece>,
}

fn market_panel_presets() -> Vec<(&'static str, f64, f64)> {
    vec![
        ("2 x 4 ft - 610 x 1219 mm", 609.6, 1219.2),
        ("4 x 4 ft - 1219 x 1219 mm", 1219.2, 1219.2),
        ("4 x 8 ft - 1219 x 2438 mm", 1219.2, 2438.4),
        ("1220 x 2440 mm", 1220.0, 2440.0),
        ("5 x 5 ft - 1524 x 1524 mm", 1524.0, 1524.0),
        ("1250 x 2500 mm", 1250.0, 2500.0),
        ("5 x 10 ft - 1524 x 3048 mm", 1524.0, 3048.0),
        ("1500 x 3000 mm", 1500.0, 3000.0),
    ]
}

fn build_layout_pieces(p: &NichoirParams, geom: &GeometryPayload) -> Vec<LayoutPiece> {
    let lang = p.lang.as_str();
    let ridge = effective_ridge(p);
    let base_defs = [
        (piece_name(lang, "facade", Some("1")), "#d4a574", "pent", geom.w_bot.max(geom.w_top), geom.wall_h + geom.roof_h, 1),
        (piece_name(lang, "facade", Some("2")), "#d4a574", "pent", geom.w_bot.max(geom.w_top), geom.wall_h + geom.roof_h, 1),
        (piece_name(lang, "side", Some(t(lang, "left_short"))), "#c49464", "rect", geom.side_d, geom.wall_h_real + geom.roof_side_cut, 1),
        (piece_name(lang, "side", Some(t(lang, "right_short"))), "#c49464", "rect", geom.side_d, geom.wall_h_real + geom.roof_side_cut, 1),
        (piece_name(lang, "floor", None), "#b48454", "rect", geom.floor_w.max(geom.floor_top_w), geom.floor_d, 1),
    ];
    let mut pieces: Vec<LayoutPiece> = base_defs
        .iter()
        .map(|(name, color, shape, w, h, qty)| LayoutPiece {
            name: name.to_string(),
            qty: *qty,
            w: *w,
            h: *h,
            color: (*color).to_string(),
            shape: (*shape).to_string(),
            rot: false,
            px: 0.0,
            py: 0.0,
            overflow: false,
            wall_h: if *shape == "pent" { Some(geom.wall_h) } else { None },
            roof_h: if *shape == "pent" { Some(geom.roof_h) } else { None },
            w_top: if *shape == "pent" { Some(geom.w_top) } else { None },
            w_bot: if *shape == "pent" { Some(geom.w_bot) } else { None },
        })
        .collect();

    let (roof_w_left, _) = poly_bounds(&roof_profile_points(p, geom, true));
    let (roof_w_right, _) = poly_bounds(&roof_profile_points(p, geom, false));
    let roof_defs = if matches!(ridge, RidgeMode::Miter) {
        vec![
            (piece_name(lang, "roof", Some("1")), geom.s_l, geom.roof_len),
            (piece_name(lang, "roof", Some("2")), geom.s_l, geom.roof_len),
        ]
    } else {
        vec![
            (piece_name(lang, "roof", Some(t(lang, "left_short"))), roof_w_left, geom.roof_len),
            (piece_name(lang, "roof", Some(t(lang, "right_short"))), roof_w_right, geom.roof_len),
        ]
    };
    for (name, w, h) in roof_defs {
        pieces.push(LayoutPiece {
            name,
            qty: 1,
            w,
            h,
            color: "#9e7044".to_string(),
            shape: "rect".to_string(),
            rot: false,
            px: 0.0,
            py: 0.0,
            overflow: false,
            wall_h: None,
            roof_h: None,
            w_top: None,
            w_bot: None,
        });
    }

    if !matches!(p.door, DoorMode::None) && p.door_panel {
        let v = (p.door_var / 100.0).max(0.0);
        pieces.push(LayoutPiece {
            name: t(lang, "door").to_string(),
            qty: 1,
            w: p.door_w * v,
            h: p.door_h * v,
            color: "#e8c088".to_string(),
            shape: "rect".to_string(),
            rot: false,
            px: 0.0,
            py: 0.0,
            overflow: false,
            wall_h: None,
            roof_h: None,
            w_top: None,
            w_bot: None,
        });
    }
    if p.wall_mount {
        let m = wall_mount_geometry(p, geom);
        pieces.push(LayoutPiece {
            name: t(lang, "wall_mount_piece").to_string(),
            qty: 1,
            w: m.block_w,
            h: m.block_h,
            color: "#7f6245".to_string(),
            shape: "rect".to_string(),
            rot: false,
            px: 0.0,
            py: 0.0,
            overflow: false,
            wall_h: None,
            roof_h: None,
            w_top: None,
            w_bot: None,
        });
    }
    pieces
}

fn pack_layout(mut sorted: Vec<LayoutPiece>, panel_w: f64, panel_h: f64, gap: f64) -> (Vec<LayoutPiece>, f64, f64) {
    sorted.sort_by(|a, b| b.h.partial_cmp(&a.h).unwrap_or(std::cmp::Ordering::Equal));
    let mut shelf_y = gap;
    let mut shelf_h: f64 = 0.0;
    let mut cur_x = gap;
    let mut placed_area = 0.0;

    for pce in sorted.iter_mut() {
        let orig_w = pce.w;
        let orig_h = pce.h;
        let fit_normal = cur_x + pce.w + gap <= panel_w && shelf_y + pce.h + gap <= panel_h;
        let fit_rot = cur_x + pce.h + gap <= panel_w && shelf_y + pce.w + gap <= panel_h;
        if fit_normal {
            pce.px = cur_x;
            pce.py = shelf_y;
            cur_x += pce.w + gap;
            shelf_h = shelf_h.max(pce.h);
            placed_area += orig_w * orig_h;
            pce.overflow = false;
            pce.rot = false;
            continue;
        }
        if fit_rot {
            pce.rot = true;
            std::mem::swap(&mut pce.w, &mut pce.h);
            pce.px = cur_x;
            pce.py = shelf_y;
            cur_x += pce.w + gap;
            shelf_h = shelf_h.max(pce.h);
            placed_area += orig_w * orig_h;
            pce.overflow = false;
            continue;
        }
        shelf_y += shelf_h + gap;
        shelf_h = orig_h;
        cur_x = gap;
        if cur_x + orig_w + gap <= panel_w {
            pce.rot = false;
            pce.w = orig_w;
            pce.h = orig_h;
            pce.px = gap;
            pce.py = shelf_y;
            if shelf_y + pce.h > panel_h {
                pce.overflow = true;
            }
            cur_x = orig_w + gap + gap;
            if !pce.overflow {
                placed_area += orig_w * orig_h;
            }
            continue;
        }
        pce.rot = true;
        pce.w = orig_h;
        pce.h = orig_w;
        pce.px = gap;
        pce.py = shelf_y;
        shelf_h = pce.h;
        cur_x = pce.w + gap + gap;
        if pce.w + gap > panel_w || shelf_y + pce.h > panel_h {
            pce.overflow = true;
        } else {
            placed_area += orig_w * orig_h;
        }
    }
    let usage = if panel_w > 0.0 && panel_h > 0.0 {
        placed_area / (panel_w * panel_h) * 100.0
    } else {
        0.0
    };
    (sorted, placed_area, usage)
}

#[wasm_bindgen]
pub fn compute_cut_layout(input: &str) -> String {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(err) => return err_json(&err),
    };

    let geom = GeometryPayload::from_p(&p);
    let gap = p.kerf.max(0.0);
    let pieces = build_layout_pieces(&p, &geom);
    let total_piece_area = pieces.iter().map(|i| i.w * i.h).sum::<f64>();
    let auto_panel = p.panel_preset == "auto";
    let (panel_label, panel_w, panel_h, sorted, placed_area, usage) = if auto_panel {
        let mut best: Option<(String, f64, f64, Vec<LayoutPiece>, f64, f64)> = None;
        for (label, w, h) in market_panel_presets() {
            let (candidate, placed, use_ratio) = pack_layout(pieces.clone(), w, h, gap);
            let overflow = candidate.iter().any(|piece| piece.overflow);
            if overflow {
                continue;
            }
            let area = w * h;
            let replace = best
                .as_ref()
                .map(|(_, bw, bh, _, _, _)| {
                    let best_w = *bw;
                    let best_h = *bh;
                    let best_area = best_w * best_h;
                    area < best_area - 0.01
                        || ((area - best_area).abs() < 0.01
                            && (w.min(h), w.max(h)) < (best_w.min(best_h), best_w.max(best_h)))
                })
                .unwrap_or(true);
            if replace {
                best = Some((label.to_string(), w, h, candidate, placed, use_ratio));
            }
        }
        best.unwrap_or_else(|| {
            let (candidate, placed, use_ratio) = pack_layout(pieces.clone(), p.panel_w, p.panel_h, gap);
            (t(p.lang.as_str(), "selected_panel_fallback").to_string(), p.panel_w, p.panel_h, candidate, placed, use_ratio)
        })
    } else {
        let (candidate, placed, use_ratio) = pack_layout(pieces, p.panel_w, p.panel_h, gap);
        (t(p.lang.as_str(), "custom_manual").to_string(), p.panel_w, p.panel_h, candidate, placed, use_ratio)
    };

    let payload = CutLayoutPayload {
        panel_w,
        panel_h,
        panel_label,
        auto_panel,
        gap,
        total_area: total_piece_area,
        placed_area,
        usage_ratio: usage,
        pieces: sorted,
    };
    ok_json(payload)
}

#[derive(Copy, Clone)]
struct Vec3 {
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Copy, Clone)]
struct Tri {
    normal: Vec3,
    a: Vec3,
    b: Vec3,
    c: Vec3,
}

#[derive(Serialize)]
struct RenderMesh {
    key: String,
    color: String,
    vertices: Vec<f32>,
}

#[derive(Serialize)]
struct ScenePayload {
    meshes: Vec<RenderMesh>,
}

fn cross(a: Vec3, b: Vec3) -> Vec3 {
    Vec3 {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    }
}

fn sub(a: Vec3, b: Vec3) -> Vec3 {
    Vec3 {
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
    }
}

fn norm(v: Vec3) -> f32 {
    (v.x * v.x + v.y * v.y + v.z * v.z).sqrt()
}

fn normalize(v: Vec3) -> Vec3 {
    let l = norm(v);
    if l > 1e-7 {
        Vec3 {
            x: v.x / l,
            y: v.y / l,
            z: v.z / l,
        }
    } else {
        Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        }
    }
}

fn tri(a: Vec3, b: Vec3, c: Vec3) -> Tri {
    let ab = sub(b, a);
    let ac = sub(c, a);
    let normal = normalize(cross(ab, ac));
    Tri {
        normal,
        a,
        b,
        c,
    }
}

fn quad(mesh: &mut Vec<Tri>, a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
    mesh.push(tri(a, b, c));
    mesh.push(tri(a, c, d));
}

fn rotate_z(v: Vec3, angle: f64) -> Vec3 {
    let c = angle.cos() as f32;
    let s = angle.sin() as f32;
    Vec3 {
        x: v.x * c - v.y * s,
        y: v.x * s + v.y * c,
        z: v.z,
    }
}

fn transform_point(v: Vec3, tx: f64, ty: f64, tz: f64, rz: f64) -> Vec3 {
    let r = rotate_z(v, rz);
    Vec3 {
        x: r.x + tx as f32,
        y: r.y + ty as f32,
        z: r.z + tz as f32,
    }
}

fn add3(a: Vec3, b: Vec3) -> Vec3 {
    Vec3 {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z,
    }
}

fn scale3(v: Vec3, s: f64) -> Vec3 {
    Vec3 {
        x: v.x * s as f32,
        y: v.y * s as f32,
        z: v.z * s as f32,
    }
}

fn dot3(a: Vec3, b: Vec3) -> f64 {
    a.x as f64 * b.x as f64 + a.y as f64 * b.y as f64 + a.z as f64 * b.z as f64
}

fn map_basis(origin: Vec3, u: Vec3, v: Vec3, n: Vec3, x: f64, y: f64, z: f64) -> Vec3 {
    add3(add3(add3(origin, scale3(u, x)), scale3(v, y)), scale3(n, z))
}

fn project_to_deco(origin: Vec3, u: Vec3, v: Vec3, p: Vec3) -> (f64, f64) {
    let delta = sub(p, origin);
    (dot3(delta, u), dot3(delta, v))
}

fn point_in_poly_2d(x: f64, y: f64, poly: &[(f64, f64)]) -> bool {
    if poly.len() < 3 {
        return true;
    }
    let mut inside = false;
    let mut j = poly.len() - 1;
    for i in 0..poly.len() {
        let (xi, yi) = poly[i];
        let (xj, yj) = poly[j];
        let intersects = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / ((yj - yi).abs().max(0.000001)) + xi);
        if intersects {
            inside = !inside;
        }
        j = i;
    }
    inside
}

fn deco_attr(tag: &str, name: &str) -> Option<String> {
    let pattern = format!("{name}=");
    let idx = tag.find(&pattern)? + pattern.len();
    let rest = &tag[idx..];
    let mut chars = rest.chars();
    let quote = chars.next()?;
    if quote == '"' || quote == '\'' {
        let end = rest[1..].find(quote)?;
        Some(rest[1..1 + end].to_string())
    } else {
        let end = rest
            .find(|c: char| c.is_whitespace() || c == '/' || c == '>')
            .unwrap_or(rest.len());
        Some(rest[..end].to_string())
    }
}

fn deco_num(tag: &str, name: &str) -> Option<f64> {
    let raw = deco_attr(tag, name)?;
    let trimmed = raw.trim().trim_end_matches("px").trim_end_matches("mm");
    trimmed.parse::<f64>().ok()
}

fn parse_points_list(raw: &str) -> Vec<(f64, f64)> {
    let values: Vec<f64> = raw
        .replace(',', " ")
        .split_whitespace()
        .filter_map(|p| p.parse::<f64>().ok())
        .collect();
    values
        .chunks(2)
        .filter_map(|pair| {
            if pair.len() == 2 {
                Some((pair[0], pair[1]))
            } else {
                None
            }
        })
        .collect()
}

fn deco_rect(tag: &str) -> Option<Vec<(f64, f64)>> {
    let x = deco_num(tag, "x").unwrap_or(0.0);
    let y = deco_num(tag, "y").unwrap_or(0.0);
    let w = deco_num(tag, "width")?;
    let h = deco_num(tag, "height")?;
    if w <= 0.0 || h <= 0.0 {
        return None;
    }
    Some(vec![(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
}

fn deco_circle(tag: &str, ellipse: bool) -> Option<Vec<(f64, f64)>> {
    let cx = deco_num(tag, "cx").unwrap_or(0.0);
    let cy = deco_num(tag, "cy").unwrap_or(0.0);
    let rx = if ellipse {
        deco_num(tag, "rx")?
    } else {
        deco_num(tag, "r")?
    };
    let ry = if ellipse {
        deco_num(tag, "ry")?
    } else {
        rx
    };
    if rx <= 0.0 || ry <= 0.0 {
        return None;
    }
    let segs = 64;
    let mut pts = Vec::with_capacity(segs);
    for i in 0..segs {
        let a = (i as f64 / segs as f64) * PI * 2.0;
        pts.push((cx + a.cos() * rx, cy + a.sin() * ry));
    }
    Some(pts)
}

fn path_tokens(raw: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut prev = '\0';
    for ch in raw.chars() {
        if ch.is_ascii_alphabetic() {
            if !cur.trim().is_empty() {
                out.push(cur.trim().to_string());
            }
            cur.clear();
            out.push(ch.to_string());
        } else if ch == '-' && prev != 'e' && prev != 'E' {
            if !cur.trim().is_empty() {
                out.push(cur.trim().to_string());
            }
            cur.clear();
            cur.push(ch);
        } else if ch == ',' || ch.is_whitespace() {
            if !cur.trim().is_empty() {
                out.push(cur.trim().to_string());
            }
            cur.clear();
        } else {
            cur.push(ch);
        }
        prev = ch;
    }
    if !cur.trim().is_empty() {
        out.push(cur.trim().to_string());
    }
    out
}

fn parse_svg_path_subset(raw: &str) -> Vec<(f64, f64)> {
    let tokens = path_tokens(raw);
    let mut pts = Vec::new();
    let mut cmd = 'M';
    let mut i = 0usize;
    let mut x = 0.0;
    let mut y = 0.0;
    let mut start = (0.0, 0.0);
    let mut last_cubic: Option<(f64, f64)> = None;
    let mut last_quad: Option<(f64, f64)> = None;

    while i < tokens.len() {
        if tokens[i].len() == 1 && tokens[i].chars().next().unwrap_or(' ').is_ascii_alphabetic() {
            cmd = tokens[i].chars().next().unwrap_or(cmd);
            i += 1;
            if cmd == 'Z' || cmd == 'z' {
                pts.push(start);
            }
            continue;
        }

        match cmd {
            'M' | 'L' | 'm' | 'l' => {
                if i + 1 >= tokens.len() {
                    break;
                }
                let nx = tokens[i].parse::<f64>().unwrap_or(x);
                let ny = tokens[i + 1].parse::<f64>().unwrap_or(y);
                if cmd == 'm' || cmd == 'l' {
                    x += nx;
                    y += ny;
                } else {
                    x = nx;
                    y = ny;
                }
                if cmd == 'M' || cmd == 'm' {
                    start = (x, y);
                    cmd = if cmd == 'm' { 'l' } else { 'L' };
                }
                pts.push((x, y));
                i += 2;
                last_cubic = None;
                last_quad = None;
            }
            'H' | 'h' => {
                let nx = tokens[i].parse::<f64>().unwrap_or(x);
                x = if cmd == 'h' { x + nx } else { nx };
                pts.push((x, y));
                i += 1;
                last_cubic = None;
                last_quad = None;
            }
            'V' | 'v' => {
                let ny = tokens[i].parse::<f64>().unwrap_or(y);
                y = if cmd == 'v' { y + ny } else { ny };
                pts.push((x, y));
                i += 1;
                last_cubic = None;
                last_quad = None;
            }
            'C' | 'c' => {
                if i + 5 >= tokens.len() {
                    break;
                }
                let mut vals = [0.0; 6];
                for k in 0..6 {
                    vals[k] = tokens[i + k].parse::<f64>().unwrap_or(0.0);
                }
                let (x1, y1, x2, y2, x3, y3) = if cmd == 'c' {
                    (x + vals[0], y + vals[1], x + vals[2], y + vals[3], x + vals[4], y + vals[5])
                } else {
                    (vals[0], vals[1], vals[2], vals[3], vals[4], vals[5])
                };
                let (x0, y0) = (x, y);
                for sidx in 1..=16 {
                    let t = sidx as f64 / 16.0;
                    let mt = 1.0 - t;
                    let px = mt.powi(3) * x0 + 3.0 * mt.powi(2) * t * x1 + 3.0 * mt * t.powi(2) * x2 + t.powi(3) * x3;
                    let py = mt.powi(3) * y0 + 3.0 * mt.powi(2) * t * y1 + 3.0 * mt * t.powi(2) * y2 + t.powi(3) * y3;
                    pts.push((px, py));
                }
                x = x3;
                y = y3;
                last_cubic = Some((x2, y2));
                last_quad = None;
                i += 6;
            }
            'S' | 's' => {
                if i + 3 >= tokens.len() {
                    break;
                }
                let (x1, y1) = last_cubic.map(|(cx, cy)| (2.0 * x - cx, 2.0 * y - cy)).unwrap_or((x, y));
                let mut vals = [0.0; 4];
                for k in 0..4 {
                    vals[k] = tokens[i + k].parse::<f64>().unwrap_or(0.0);
                }
                let (x2, y2, x3, y3) = if cmd == 's' {
                    (x + vals[0], y + vals[1], x + vals[2], y + vals[3])
                } else {
                    (vals[0], vals[1], vals[2], vals[3])
                };
                let (x0, y0) = (x, y);
                for sidx in 1..=16 {
                    let t = sidx as f64 / 16.0;
                    let mt = 1.0 - t;
                    let px = mt.powi(3) * x0 + 3.0 * mt.powi(2) * t * x1 + 3.0 * mt * t.powi(2) * x2 + t.powi(3) * x3;
                    let py = mt.powi(3) * y0 + 3.0 * mt.powi(2) * t * y1 + 3.0 * mt * t.powi(2) * y2 + t.powi(3) * y3;
                    pts.push((px, py));
                }
                x = x3;
                y = y3;
                last_cubic = Some((x2, y2));
                last_quad = None;
                i += 4;
            }
            'Q' | 'q' => {
                if i + 3 >= tokens.len() {
                    break;
                }
                let mut vals = [0.0; 4];
                for k in 0..4 {
                    vals[k] = tokens[i + k].parse::<f64>().unwrap_or(0.0);
                }
                let (x1, y1, x2, y2) = if cmd == 'q' {
                    (x + vals[0], y + vals[1], x + vals[2], y + vals[3])
                } else {
                    (vals[0], vals[1], vals[2], vals[3])
                };
                let (x0, y0) = (x, y);
                for sidx in 1..=14 {
                    let t = sidx as f64 / 14.0;
                    let mt = 1.0 - t;
                    let px = mt.powi(2) * x0 + 2.0 * mt * t * x1 + t.powi(2) * x2;
                    let py = mt.powi(2) * y0 + 2.0 * mt * t * y1 + t.powi(2) * y2;
                    pts.push((px, py));
                }
                x = x2;
                y = y2;
                last_quad = Some((x1, y1));
                last_cubic = None;
                i += 4;
            }
            'T' | 't' => {
                if i + 1 >= tokens.len() {
                    break;
                }
                let (x1, y1) = last_quad.map(|(qx, qy)| (2.0 * x - qx, 2.0 * y - qy)).unwrap_or((x, y));
                let nx = tokens[i].parse::<f64>().unwrap_or(x);
                let ny = tokens[i + 1].parse::<f64>().unwrap_or(y);
                let (x2, y2) = if cmd == 't' { (x + nx, y + ny) } else { (nx, ny) };
                let (x0, y0) = (x, y);
                for sidx in 1..=14 {
                    let t = sidx as f64 / 14.0;
                    let mt = 1.0 - t;
                    let px = mt.powi(2) * x0 + 2.0 * mt * t * x1 + t.powi(2) * x2;
                    let py = mt.powi(2) * y0 + 2.0 * mt * t * y1 + t.powi(2) * y2;
                    pts.push((px, py));
                }
                x = x2;
                y = y2;
                last_quad = Some((x1, y1));
                last_cubic = None;
                i += 2;
            }
            'A' | 'a' => {
                if i + 6 >= tokens.len() {
                    break;
                }
                let nx = tokens[i + 5].parse::<f64>().unwrap_or(x);
                let ny = tokens[i + 6].parse::<f64>().unwrap_or(y);
                x = if cmd == 'a' { x + nx } else { nx };
                y = if cmd == 'a' { y + ny } else { ny };
                pts.push((x, y));
                last_cubic = None;
                last_quad = None;
                i += 7;
            }
            _ => {
                i += 1;
            }
        }
    }

    pts
}

fn parse_deco_svg_loops(svg: &str) -> Vec<Vec<(f64, f64)>> {
    let mut loops = Vec::new();
    for piece in svg.split('<').skip(1) {
        let Some(end) = piece.find('>') else { continue };
        let tag = &piece[..end];
        let name = tag
            .split_whitespace()
            .next()
            .unwrap_or("")
            .trim_matches('/')
            .to_ascii_lowercase();
        let pts = match name.as_str() {
            "rect" => deco_rect(tag),
            "circle" => deco_circle(tag, false),
            "ellipse" => deco_circle(tag, true),
            "polygon" => deco_attr(tag, "points").map(|v| parse_points_list(&v)),
            "polyline" => deco_attr(tag, "points").map(|v| parse_points_list(&v)),
            "line" => {
                let x1 = deco_num(tag, "x1").unwrap_or(0.0);
                let y1 = deco_num(tag, "y1").unwrap_or(0.0);
                let x2 = deco_num(tag, "x2").unwrap_or(0.0);
                let y2 = deco_num(tag, "y2").unwrap_or(0.0);
                let dx = x2 - x1;
                let dy = y2 - y1;
                let len = (dx * dx + dy * dy).sqrt();
                if len > 0.001 {
                    let w = 1.0;
                    let nx = -dy / len * w;
                    let ny = dx / len * w;
                    Some(vec![
                        (x1 + nx, y1 + ny),
                        (x2 + nx, y2 + ny),
                        (x2 - nx, y2 - ny),
                        (x1 - nx, y1 - ny),
                    ])
                } else {
                    None
                }
            }
            "path" => deco_attr(tag, "d").map(|v| parse_svg_path_subset(&v)),
            _ => None,
        };
        if let Some(mut pts) = pts {
            if pts.len() >= 3 && polygon_area(&pts).abs() > 0.01 {
                if polygon_area(&pts) < 0.0 {
                    pts.reverse();
                }
                loops.push(pts);
            }
        }
    }
    loops
}

fn bounds_2d(loops: &[Vec<(f64, f64)>]) -> Option<(f64, f64, f64, f64)> {
    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    let mut found = false;
    for loop_pts in loops {
        for (x, y) in loop_pts {
            min_x = min_x.min(*x);
            min_y = min_y.min(*y);
            max_x = max_x.max(*x);
            max_y = max_y.max(*y);
            found = true;
        }
    }
    if found {
        Some((min_x, min_y, max_x, max_y))
    } else {
        None
    }
}

fn deco_normalized_loops(d: &DecorSettings) -> Vec<Vec<(f64, f64)>> {
    if !d.enabled || d.source_text.trim().is_empty() || d.source_type != "svg" {
        return Vec::new();
    }
    let loops = parse_deco_svg_loops(&d.source_text);
    let Some((min_x, min_y, max_x, max_y)) = bounds_2d(&loops) else {
        return Vec::new();
    };
    let bw = (max_x - min_x).abs().max(0.001);
    let bh = (max_y - min_y).abs().max(0.001);
    let rot = d.rotation * PI / 180.0;
    let c = rot.cos();
    let s = rot.sin();

    loops
        .into_iter()
        .map(|loop_pts| {
            loop_pts
                .into_iter()
                .map(|(x, y)| {
                    let px = ((x - min_x) / bw - 0.5) * d.w.max(1.0);
                    let py = (0.5 - (y - min_y) / bh) * d.h.max(1.0);
                    (px * c - py * s, px * s + py * c)
                })
                .collect()
        })
        .collect()
}

fn add_deco_loop_basis(
    mesh: &mut Vec<Tri>,
    points: &[(f64, f64)],
    depth: f64,
    origin: Vec3,
    u: Vec3,
    v: Vec3,
    n: Vec3,
) {
    if points.len() < 3 {
        return;
    }
    let dz = depth.max(0.2);
    let base: Vec<Vec3> = points
        .iter()
        .map(|(x, y)| map_basis(origin, u, v, n, *x, *y, 0.0))
        .collect();
    let top: Vec<Vec3> = points
        .iter()
        .map(|(x, y)| map_basis(origin, u, v, n, *x, *y, dz))
        .collect();
    for i in 1..points.len() - 1 {
        mesh.push(tri(base[0], base[i + 1], base[i]));
        mesh.push(tri(top[0], top[i], top[i + 1]));
    }
    for i in 0..points.len() {
        let j = (i + 1) % points.len();
        quad(mesh, base[i], base[j], top[j], top[i]);
    }
}

fn decode_deco_luma(d: &DecorSettings) -> Option<(usize, usize, Vec<f64>)> {
    if d.source_data.trim().is_empty() {
        return None;
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(d.source_data.trim())
        .ok()?;
    let decoded = image::load_from_memory(&bytes).ok()?;
    let (w, h) = (decoded.width(), decoded.height());
    if w < 2 || h < 2 {
        return None;
    }
    if w > MAX_DECO_IMAGE_SIDE || h > MAX_DECO_IMAGE_SIDE || u64::from(w) * u64::from(h) > MAX_DECO_IMAGE_PIXELS {
        return None;
    }
    let img = decoded.to_rgba8();
    let mut values = Vec::with_capacity((w * h) as usize);
    for p in img.pixels() {
        let a = p[3] as f64 / 255.0;
        let r = p[0] as f64 / 255.0;
        let g = p[1] as f64 / 255.0;
        let b = p[2] as f64 / 255.0;
        let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let near_white = r > 0.92 && g > 0.92 && b > 0.92;
        let near_transparent = a < 0.05;
        let value = if d.remove_bg && (near_white || near_transparent) {
            0.0
        } else {
            l * a
        };
        values.push(value.clamp(0.0, 1.0));
    }
    Some((w as usize, h as usize, values))
}

fn sample_luma(src_w: usize, src_h: usize, values: &[f64], u: f64, v: f64) -> f64 {
    if src_w == 0 || src_h == 0 || values.is_empty() {
        return 0.0;
    }
    let x = (u.clamp(0.0, 1.0) * (src_w.saturating_sub(1)) as f64).round() as usize;
    let y = (v.clamp(0.0, 1.0) * (src_h.saturating_sub(1)) as f64).round() as usize;
    values.get(y * src_w + x).copied().unwrap_or(0.0)
}

fn smooth_values(w: usize, h: usize, values: &[f64], passes: usize) -> Vec<f64> {
    if passes == 0 || w < 3 || h < 3 || values.len() != w * h {
        return values.to_vec();
    }
    let mut cur = values.to_vec();
    let mut next = cur.clone();
    for _ in 0..passes {
        for y in 0..h {
            for x in 0..w {
                let idx = y * w + x;
                if x == 0 || y == 0 || x + 1 == w || y + 1 == h {
                    next[idx] = cur[idx];
                    continue;
                }
                let mut sum = cur[idx] * 4.0;
                sum += cur[idx - 1];
                sum += cur[idx + 1];
                sum += cur[idx - w];
                sum += cur[idx + w];
                sum += cur[idx - w - 1] * 0.5;
                sum += cur[idx - w + 1] * 0.5;
                sum += cur[idx + w - 1] * 0.5;
                sum += cur[idx + w + 1] * 0.5;
                next[idx] = sum / 10.0;
            }
        }
        std::mem::swap(&mut cur, &mut next);
    }
    cur
}

fn shape_height_value(raw: f64, d: &DecorSettings) -> f64 {
    let mut v = raw.clamp(0.0, 1.0);
    let threshold = (d.threshold / 100.0).clamp(0.0, 0.95);
    if threshold > 0.0 {
        v = if v <= threshold { 0.0 } else { (v - threshold) / (1.0 - threshold) };
    }
    let bevel = (d.bevel / 100.0).clamp(0.0, 1.0);
    if bevel > 0.0 {
        let gamma = 1.0 + bevel * 3.0;
        v = v.powf(gamma);
    }
    v.clamp(0.0, 1.0)
}

fn add_heightmap_basis(
    mesh: &mut Vec<Tri>,
    d: &DecorSettings,
    origin: Vec3,
    u_axis: Vec3,
    v_axis: Vec3,
    n_axis: Vec3,
    clip_poly: Option<&[(f64, f64)]>,
    clip_holes: Option<&[Vec<(f64, f64)>]>,
) {
    let Some((src_w, src_h, values)) = decode_deco_luma(d) else {
        return;
    };
    let smooth_passes = (d.smooth / 20.0).round().clamp(0.0, 8.0) as usize;
    let values = smooth_values(src_w, src_h, &values, smooth_passes);
    let res = d.resolution.round().clamp(8.0, 256.0) as usize;
    let w = d.w.max(1.0);
    let h = d.h.max(1.0);
    let depth = d.depth.max(0.1);
    let mut verts = Vec::<Vec3>::with_capacity((res + 1) * (res + 1));
    let mut base_verts = Vec::<Vec3>::with_capacity((res + 1) * (res + 1));
    let mut mask = Vec::<bool>::with_capacity((res + 1) * (res + 1));
    let rot = d.rotation * PI / 180.0;
    let c = rot.cos();
    let s = rot.sin();

    for iy in 0..=res {
        let fy = iy as f64 / res as f64;
        for ix in 0..=res {
            let fx = ix as f64 / res as f64;
            let mut local_x = (fx - 0.5) * w;
            let mut local_y = (0.5 - fy) * h;
            let rx = local_x * c - local_y * s;
            let ry = local_x * s + local_y * c;
            local_x = rx;
            local_y = ry;
            let inside = clip_poly
                .map(|poly| point_in_poly_2d(local_x, local_y, poly))
                .unwrap_or(true);
            let in_hole = clip_holes
                .map(|holes| holes.iter().any(|hole| point_in_poly_2d(local_x, local_y, hole)))
                .unwrap_or(false);
            let mut lum = sample_luma(src_w, src_h, &values, fx, fy);
            if d.invert {
                lum = 1.0 - lum;
            }
            lum = shape_height_value(lum, d);
            let z = if inside && !in_hole { lum * depth } else { 0.0 };
            base_verts.push(map_basis(origin, u_axis, v_axis, n_axis, local_x, local_y, 0.0));
            verts.push(map_basis(origin, u_axis, v_axis, n_axis, local_x, local_y, z));
            mask.push(inside && !in_hole);
        }
    }

    let idx = |x: usize, y: usize| -> usize { y * (res + 1) + x };
    let cell_active = |x: usize, y: usize, mask: &[bool]| -> bool {
        mask[idx(x, y)] && mask[idx(x + 1, y)] && mask[idx(x + 1, y + 1)] && mask[idx(x, y + 1)]
    };
    for y in 0..res {
        for x in 0..res {
            if !cell_active(x, y, &mask) {
                continue;
            }
            let a = verts[idx(x, y)];
            let b = verts[idx(x + 1, y)];
            let c = verts[idx(x + 1, y + 1)];
            let dpt = verts[idx(x, y + 1)];
            mesh.push(tri(a, b, c));
            mesh.push(tri(a, c, dpt));

            let ba = base_verts[idx(x, y)];
            let bb = base_verts[idx(x + 1, y)];
            let bc = base_verts[idx(x + 1, y + 1)];
            let bd = base_verts[idx(x, y + 1)];
            mesh.push(tri(ba, bc, bb));
            mesh.push(tri(ba, bd, bc));

            if y == 0 || !cell_active(x, y - 1, &mask) {
                quad(mesh, ba, bb, b, a);
            }
            if x + 1 == res || !cell_active(x + 1, y, &mask) {
                quad(mesh, bb, bc, c, b);
            }
            if y + 1 == res || !cell_active(x, y + 1, &mask) {
                quad(mesh, bd, dpt, c, bc);
            }
            if x == 0 || !cell_active(x - 1, y, &mask) {
                quad(mesh, ba, a, dpt, bd);
            }
        }
    }
}

fn add_box(mesh: &mut Vec<Tri>, cx: f64, cy: f64, cz: f64, w: f64, h: f64, d: f64) {
    let hw = (w as f32) / 2.0;
    let hh = (h as f32) / 2.0;
    let hd = (d as f32) / 2.0;
    let cx = cx as f32;
    let cy = cy as f32;
    let cz = cz as f32;

    let p000 = Vec3 {
        x: cx - hw,
        y: cy - hh,
        z: cz - hd,
    };
    let p100 = Vec3 {
        x: cx + hw,
        y: cy - hh,
        z: cz - hd,
    };
    let p110 = Vec3 {
        x: cx + hw,
        y: cy + hh,
        z: cz - hd,
    };
    let p010 = Vec3 {
        x: cx - hw,
        y: cy + hh,
        z: cz - hd,
    };
    let p001 = Vec3 {
        x: cx - hw,
        y: cy - hh,
        z: cz + hd,
    };
    let p101 = Vec3 {
        x: cx + hw,
        y: cy - hh,
        z: cz + hd,
    };
    let p111 = Vec3 {
        x: cx + hw,
        y: cy + hh,
        z: cz + hd,
    };
    let p011 = Vec3 {
        x: cx - hw,
        y: cy + hh,
        z: cz + hd,
    };

    // front
    quad(mesh, p000, p100, p110, p010);
    // back
    quad(mesh, p001, p011, p111, p101);
    // top
    quad(mesh, p010, p110, p111, p011);
    // bottom
    quad(mesh, p001, p101, p100, p000);
    // left
    quad(mesh, p001, p000, p010, p011);
    // right
    quad(mesh, p100, p101, p111, p110);
}

fn add_floor_panel(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload) {
    if matches!(p.floor, FloorMode::Pose) || g.floor_side_cut.abs() < 1e-9 {
        add_box(mesh, 0.0, p.t / 2.0, 0.0, g.floor_w, p.t, g.floor_d);
        return;
    }

    let bw = (g.floor_w as f32) / 2.0;
    let tw = (g.floor_top_w as f32) / 2.0;
    let y0 = 0.0_f32;
    let y1 = p.t as f32;
    let zf = (g.floor_d as f32) / 2.0;
    let zb = -zf;

    let b0 = Vec3 { x: -bw, y: y0, z: zf };
    let b1 = Vec3 { x: bw, y: y0, z: zf };
    let b2 = Vec3 { x: bw, y: y0, z: zb };
    let b3 = Vec3 { x: -bw, y: y0, z: zb };
    let t0 = Vec3 { x: -tw, y: y1, z: zf };
    let t1 = Vec3 { x: tw, y: y1, z: zf };
    let t2 = Vec3 { x: tw, y: y1, z: zb };
    let t3 = Vec3 { x: -tw, y: y1, z: zb };

    quad(mesh, b3, b2, b1, b0);
    quad(mesh, t0, t1, t2, t3);
    quad(mesh, b0, b1, t1, t0);
    quad(mesh, b2, b3, t3, t2);
    quad(mesh, b3, b0, t0, t3);
    quad(mesh, b1, b2, t2, t1);
}

fn floor_panel_tris(p: &NichoirParams, g: &GeometryPayload) -> Vec<Tri> {
    let mut tris = Vec::<Tri>::new();
    add_floor_panel(&mut tris, p, g);
    clean_tris(tris)
}

fn add_cylinder_z(mesh: &mut Vec<Tri>, cx: f64, cy: f64, z0: f64, radius: f64, len: f64, segments: usize) {
    let segs = segments.max(12);
    let r = radius.max(0.25);
    let z1 = z0 + len.max(0.5);
    let c0 = Vec3 { x: cx as f32, y: cy as f32, z: z0 as f32 };
    let c1 = Vec3 { x: cx as f32, y: cy as f32, z: z1 as f32 };
    for i in 0..segs {
        let a0 = (i as f64 / segs as f64) * PI * 2.0;
        let a1 = ((i + 1) as f64 / segs as f64) * PI * 2.0;
        let p0 = Vec3 {
            x: (cx + a0.cos() * r) as f32,
            y: (cy + a0.sin() * r) as f32,
            z: z0 as f32,
        };
        let p1 = Vec3 {
            x: (cx + a1.cos() * r) as f32,
            y: (cy + a1.sin() * r) as f32,
            z: z0 as f32,
        };
        let q0 = Vec3 { z: z1 as f32, ..p0 };
        let q1 = Vec3 { z: z1 as f32, ..p1 };
        quad(mesh, p0, p1, q1, q0);
        mesh.push(tri(c0, p1, p0));
        mesh.push(tri(c1, q0, q1));
    }
}

fn add_side_panel_with_cuts(mesh: &mut Vec<Tri>, inner: [Vec3; 4], outer: [Vec3; 4]) {
    quad(mesh, inner[0], inner[1], inner[2], inner[3]);
    quad(mesh, outer[0], outer[3], outer[2], outer[1]);
    quad(mesh, inner[0], outer[0], outer[1], inner[1]);
    quad(mesh, inner[3], inner[2], outer[2], outer[3]);
    quad(mesh, inner[0], inner[3], outer[3], outer[0]);
    quad(mesh, inner[1], outer[1], outer[2], inner[2]);
}

fn add_one_side_wall(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload, base_y: f64, left: bool) {
    let alpha = (p.taper_x / g.wall_h.max(0.001)).atan();
    let inset = p.t / alpha.cos().max(0.001);
    let roof_extra = inset * (p.slope * PI / 180.0).tan();
    let half_d_inner = (p.d / 2.0 - p.t) as f32;
    let y0 = base_y as f32;
    let y1_outer = (base_y + g.wall_h) as f32;
    let y1_inner = (base_y + g.wall_h + roof_extra) as f32;
    let zf = half_d_inner;
    let zb = -half_d_inner;

    if left {
        let outer_bottom = (-g.w_bot / 2.0) as f32;
        let outer_top = (-g.w_top / 2.0) as f32;
        let inner_bottom = (-g.w_bot / 2.0 + inset) as f32;
        let inner_top = (-g.w_top / 2.0 + inset) as f32;
        add_side_panel_with_cuts(
            mesh,
            [
                Vec3 { x: inner_bottom, y: y0, z: zf },
                Vec3 { x: inner_bottom, y: y0, z: zb },
                Vec3 { x: inner_top, y: y1_inner, z: zb },
                Vec3 { x: inner_top, y: y1_inner, z: zf },
            ],
            [
                Vec3 { x: outer_bottom, y: y0, z: zf },
                Vec3 { x: outer_bottom, y: y0, z: zb },
                Vec3 { x: outer_top, y: y1_outer, z: zb },
                Vec3 { x: outer_top, y: y1_outer, z: zf },
            ],
        );
    } else {
        let outer_bottom = (g.w_bot / 2.0) as f32;
        let outer_top = (g.w_top / 2.0) as f32;
        let inner_bottom = (g.w_bot / 2.0 - inset) as f32;
        let inner_top = (g.w_top / 2.0 - inset) as f32;
        add_side_panel_with_cuts(
            mesh,
            [
                Vec3 { x: inner_bottom, y: y0, z: zb },
                Vec3 { x: inner_bottom, y: y0, z: zf },
                Vec3 { x: inner_top, y: y1_inner, z: zf },
                Vec3 { x: inner_top, y: y1_inner, z: zb },
            ],
            [
                Vec3 { x: outer_bottom, y: y0, z: zb },
                Vec3 { x: outer_bottom, y: y0, z: zf },
                Vec3 { x: outer_top, y: y1_outer, z: zf },
                Vec3 { x: outer_top, y: y1_outer, z: zb },
            ],
        );
    }
}

fn add_side_walls(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload, base_y: f64) {
    add_one_side_wall(mesh, p, g, base_y, true);
    add_one_side_wall(mesh, p, g, base_y, false);
}

fn side_panel_tris(p: &NichoirParams, g: &GeometryPayload, left: bool) -> Vec<Tri> {
    let base_y = if matches!(p.floor, FloorMode::Pose) { p.t } else { 0.0 };
    let mut tris = Vec::<Tri>::new();
    add_one_side_wall(&mut tris, p, g, base_y, left);
    clean_tris(tris)
}

fn add_extruded_polygon_z(mesh: &mut Vec<Tri>, points: &[(f64, f64)], depth: f64, tx: f64, ty: f64, tz: f64, rz: f64) {
    add_extruded_polygon_z_skip_edges(mesh, points, depth, tx, ty, tz, rz, &[]);
}

fn add_extruded_polygon_z_skip_edges(
    mesh: &mut Vec<Tri>,
    points: &[(f64, f64)],
    depth: f64,
    tx: f64,
    ty: f64,
    tz: f64,
    rz: f64,
    skip_side_edges: &[usize],
) {
    if points.len() < 3 {
        return;
    }
    let dz = depth.max(0.5);
    let bottom: Vec<Vec3> = points
        .iter()
        .map(|(x, y)| transform_point(Vec3 { x: *x as f32, y: *y as f32, z: 0.0 }, tx, ty, tz, rz))
        .collect();
    let top: Vec<Vec3> = points
        .iter()
        .map(|(x, y)| transform_point(Vec3 { x: *x as f32, y: *y as f32, z: dz as f32 }, tx, ty, tz, rz))
        .collect();

    for i in 1..points.len() - 1 {
        mesh.push(tri(bottom[0], bottom[i + 1], bottom[i]));
        mesh.push(tri(top[0], top[i], top[i + 1]));
    }

    for i in 0..points.len() {
        if skip_side_edges.contains(&i) {
            continue;
        }
        let j = (i + 1) % points.len();
        quad(mesh, bottom[i], bottom[j], top[j], top[i]);
    }
}

fn polygon_area(points: &[(f64, f64)]) -> f64 {
    let mut area = 0.0;
    for i in 0..points.len() {
        let j = (i + 1) % points.len();
        area += points[i].0 * points[j].1 - points[j].0 * points[i].1;
    }
    area * 0.5
}

fn add_extruded_poly_if_valid(mesh: &mut Vec<Tri>, points: &[(f64, f64)], depth: f64, tx: f64, ty: f64, tz: f64, skip_edges: &[usize]) {
    if points.len() >= 3 && polygon_area(points).abs() > 0.01 {
        add_extruded_polygon_z_skip_edges(mesh, points, depth, tx, ty, tz, 0.0, skip_edges);
    }
}

fn add_extruded_shape_with_holes_z(
    mesh: &mut Vec<Tri>,
    outer: &[(f64, f64)],
    holes: &[Vec<(f64, f64)>],
    depth: f64,
    tx: f64,
    ty: f64,
    tz: f64,
) -> bool {
    if outer.len() < 3 {
        return false;
    }

    let mut rings = Vec::<Vec<(f64, f64)>>::new();
    let mut outer_ring = outer.to_vec();
    if polygon_area(&outer_ring) < 0.0 {
        outer_ring.reverse();
    }
    rings.push(outer_ring);

    for hole in holes {
        if hole.len() < 3 || polygon_area(hole).abs() <= 0.01 {
            continue;
        }
        let mut ring = hole.clone();
        if polygon_area(&ring) > 0.0 {
            ring.reverse();
        }
        rings.push(ring);
    }

    let mut coords = Vec::<f64>::new();
    let mut points = Vec::<(f64, f64)>::new();
    let mut hole_indices = Vec::<usize>::new();
    for (idx, ring) in rings.iter().enumerate() {
        if idx > 0 {
            hole_indices.push(points.len());
        }
        for (x, y) in ring {
            coords.push(*x);
            coords.push(*y);
            points.push((*x, *y));
        }
    }

    let indices = match earcutr::earcut(&coords, &hole_indices, 2) {
        Ok(v) if !v.is_empty() => v,
        _ => return false,
    };

    let dz = depth.max(0.5);
    let v = |x: f64, y: f64, z: f64| transform_point(Vec3 { x: x as f32, y: y as f32, z: z as f32 }, tx, ty, tz, 0.0);

    let bottom: Vec<Vec3> = points.iter().map(|(x, y)| v(*x, *y, 0.0)).collect();
    let top: Vec<Vec3> = points.iter().map(|(x, y)| v(*x, *y, dz)).collect();
    for tri_idx in indices.chunks(3) {
        if tri_idx.len() != 3 {
            continue;
        }
        let a = tri_idx[0];
        let b = tri_idx[1];
        let c = tri_idx[2];
        mesh.push(tri(bottom[a], bottom[c], bottom[b]));
        mesh.push(tri(top[a], top[b], top[c]));
    }

    if let Some(outer_ring) = rings.first() {
        for i in 0..outer_ring.len() {
            let j = (i + 1) % outer_ring.len();
            let a = v(outer_ring[i].0, outer_ring[i].1, 0.0);
            let b = v(outer_ring[j].0, outer_ring[j].1, 0.0);
            let c = v(outer_ring[j].0, outer_ring[j].1, dz);
            let d = v(outer_ring[i].0, outer_ring[i].1, dz);
            quad(mesh, a, b, c, d);
        }
    }

    for hole in rings.iter().skip(1) {
        for i in 0..hole.len() {
            let j = (i + 1) % hole.len();
            let a = v(hole[i].0, hole[i].1, 0.0);
            let b = v(hole[j].0, hole[j].1, 0.0);
            let c = v(hole[j].0, hole[j].1, dz);
            let d = v(hole[i].0, hole[i].1, dz);
            quad(mesh, b, a, d, c);
        }
    }

    true
}

fn point_in_poly(x: f64, y: f64, poly: &[(f64, f64)]) -> bool {
    let mut inside = false;
    let mut j = poly.len().saturating_sub(1);
    for i in 0..poly.len() {
        let (xi, yi) = poly[i];
        let (xj, yj) = poly[j];
        if ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi).abs().max(1e-9)) + xi) {
            inside = !inside;
        }
        j = i;
    }
    inside
}

fn door_center(p: &NichoirParams, g: &GeometryPayload) -> (f64, f64) {
    let y = p.door_py / 100.0 * g.wall_h;
    let local_w = g.w_bot - 2.0 * p.taper_x * (p.door_py / 100.0);
    let x = -local_w / 2.0 + p.door_px / 100.0 * local_w;
    (x, y)
}

fn door_hole_points(p: &NichoirParams, g: &GeometryPayload) -> Vec<(f64, f64)> {
    let (cx, cy) = door_center(p, g);
    let w = p.door_w.max(0.5);
    let h = p.door_h.max(0.5);
    match p.door {
        DoorMode::Pentagon => {
            let peak_h = w * 0.35;
            let box_h = (h - peak_h).max(h * 0.5);
            let slope = if p.door_follow_taper {
                p.taper_x / g.wall_h.max(0.001)
            } else {
                0.0
            };
            let y_bot = -h / 2.0;
            let y_shoulder = -h / 2.0 + box_h;
            vec![
                (cx - w / 2.0 + slope * y_bot, cy + y_bot),
                (cx + w / 2.0 - slope * y_bot, cy + y_bot),
                (cx + w / 2.0 - slope * y_shoulder, cy + y_shoulder),
                (cx, cy + h / 2.0),
                (cx - w / 2.0 + slope * y_shoulder, cy + y_shoulder),
            ]
        }
        DoorMode::Square => vec![
            (cx - w / 2.0, cy - h / 2.0),
            (cx + w / 2.0, cy - h / 2.0),
            (cx + w / 2.0, cy + h / 2.0),
            (cx - w / 2.0, cy + h / 2.0),
        ],
        DoorMode::Round | DoorMode::None => Vec::new(),
    }
}

fn ellipse_points(cx: f64, cy: f64, rx: f64, ry: f64, segments: usize) -> Vec<(f64, f64)> {
    let segs = segments.max(12);
    let mut pts = Vec::with_capacity(segs);
    for i in 0..segs {
        let a = (i as f64 / segs as f64) * PI * 2.0;
        pts.push((cx + a.cos() * rx, cy + a.sin() * ry));
    }
    pts
}

fn facade_holes(p: &NichoirParams, g: &GeometryPayload) -> Vec<Vec<(f64, f64)>> {
    let mut holes = Vec::new();

    if !matches!(p.door, DoorMode::None) {
        let (cx, cy) = door_center(p, g);
        let door = match p.door {
            DoorMode::Round => ellipse_points(cx, cy, p.door_w.max(0.5) / 2.0, p.door_h.max(0.5) / 2.0, 64),
            DoorMode::Square | DoorMode::Pentagon => door_hole_points(p, g),
            DoorMode::None => Vec::new(),
        };
        if !door.is_empty() {
            holes.push(door);
        }
    }

    if p.perch && !matches!(p.door, DoorMode::None) {
        let (cx, cy) = perch_center(p, g);
        holes.push(ellipse_points(
            cx,
            cy,
            p.perch_diam.max(0.5) / 2.0,
            p.perch_diam.max(0.5) / 2.0,
            32,
        ));
    }

    holes
}

struct WallMountGeometry {
    y: f64,
    hole_radius: f64,
    hole_spacing: f64,
    block_w: f64,
    block_h: f64,
    block_depth: f64,
}

const WALL_MOUNT_SHED_ANGLE_DEG: f64 = 30.0;
const WALL_MOUNT_SHED_EDGE_THICKNESS: f64 = 1.5;
const WALL_MOUNT_SHED_INSET: f64 = 0.05;

fn wall_mount_depth(p: &NichoirParams) -> f64 {
    if p.wall_mount_block_depth.is_finite() && p.wall_mount_block_depth > 0.0 {
        p.wall_mount_block_depth
    } else {
        p.overhang.max(6.0)
    }
    .clamp(6.0, 80.0)
}

fn wall_mount_geometry(p: &NichoirParams, g: &GeometryPayload) -> WallMountGeometry {
    let hole_radius = (p.wall_mount_hole_diam / 2.0).clamp(1.5, 10.0);
    let block_h = p.wall_mount_block_h.clamp(30.0, g.wall_h.max(30.0));
    let y_margin = (block_h / 2.0 + 4.0).min((g.wall_h / 2.0).max(4.0));
    let max_y = (g.wall_h - y_margin).max(y_margin);
    let y = p.wall_mount_y.clamp(y_margin, max_y);
    let wall_w = (wall_right_x(g, y) - wall_left_x(g, y)).max(40.0);
    let max_block_w = (wall_w - 8.0).max(40.0);
    let block_w = p.wall_mount_block_w.clamp(40.0, max_block_w);
    let max_spacing = (wall_w.min(block_w) - p.wall_mount_hole_diam - 16.0).max(0.0);
    let min_spacing = (p.wall_mount_hole_diam * 2.0).min(max_spacing.max(p.wall_mount_hole_diam));
    let hole_spacing = if max_spacing <= min_spacing {
        max_spacing.max(p.wall_mount_hole_diam)
    } else {
        p.wall_mount_hole_spacing.clamp(min_spacing, max_spacing)
    };

    WallMountGeometry {
        y,
        hole_radius,
        hole_spacing,
        block_w,
        block_h,
        block_depth: wall_mount_depth(p),
    }
}

fn wall_mount_shed_rise(m: &WallMountGeometry) -> f64 {
    let desired = m.block_depth * (WALL_MOUNT_SHED_ANGLE_DEG * PI / 180.0).tan();
    desired.clamp(2.0, (m.block_h * 0.45).max(2.0))
}

fn wall_mount_holes(p: &NichoirParams, g: &GeometryPayload) -> Vec<Vec<(f64, f64)>> {
    if !p.wall_mount {
        return Vec::new();
    }
    let m = wall_mount_geometry(p, g);
    let half = m.hole_spacing / 2.0;
    vec![
        ellipse_points(-half, m.y, m.hole_radius, m.hole_radius, 32),
        ellipse_points(half, m.y, m.hole_radius, m.hole_radius, 32),
    ]
}

fn perch_center(p: &NichoirParams, g: &GeometryPayload) -> (f64, f64) {
    let door_y = p.door_py / 100.0 * g.wall_h;
    let y = door_y - p.door_h / 2.0 - p.perch_off;
    let y_frac = (y / g.wall_h.max(0.001)).clamp(0.0, 1.0);
    let local_w = g.w_bot - 2.0 * p.taper_x * y_frac;
    let x = -local_w / 2.0 + p.door_px / 100.0 * local_w;
    (x, y)
}

fn point_in_cutout(p: &NichoirParams, g: &GeometryPayload, x: f64, y: f64) -> bool {
    if !matches!(p.door, DoorMode::None) {
        let (cx, cy) = door_center(p, g);
        let w = p.door_w.max(0.5);
        let h = p.door_h.max(0.5);
        let in_door = match p.door {
            DoorMode::Round => {
                let dx = (x - cx) / (w / 2.0);
                let dy = (y - cy) / (h / 2.0);
                dx * dx + dy * dy <= 1.0
            }
            DoorMode::Square | DoorMode::Pentagon => point_in_poly(x, y, &door_hole_points(p, g)),
            DoorMode::None => false,
        };
        if in_door {
            return true;
        }
    }

    if p.perch && !matches!(p.door, DoorMode::None) {
        let (perch_x, perch_y) = perch_center(p, g);
        let dx = x - perch_x;
        let dy = y - perch_y;
        return dx * dx + dy * dy <= (p.perch_diam / 2.0).powi(2);
    }

    false
}

fn add_line_sorted(values: &mut Vec<f64>, v: f64) {
    if v.is_finite() {
        values.push(v);
    }
}

fn sorted_dedup(mut values: Vec<f64>) -> Vec<f64> {
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    values.dedup_by(|a, b| (*a - *b).abs() < 0.001);
    values
}

fn wall_left_x(g: &GeometryPayload, y: f64) -> f64 {
    -g.w_bot / 2.0 + (g.w_bot - g.w_top) * 0.5 * (y / g.wall_h.max(0.001))
}

fn wall_right_x(g: &GeometryPayload, y: f64) -> f64 {
    g.w_bot / 2.0 - (g.w_bot - g.w_top) * 0.5 * (y / g.wall_h.max(0.001))
}

fn add_facade_with_polygon_door(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload, depth: f64, tx: f64, ty: f64, tz: f64) {
    let gable_poly = vec![
        (-g.w_top / 2.0, g.wall_h),
        (g.w_top / 2.0, g.wall_h),
        (0.0, g.wall_h + g.roof_h),
    ];
    add_extruded_polygon_z(mesh, &gable_poly, depth, tx, ty, tz, 0.0);

    let d = door_hole_points(p, g);
    if d.len() < 4 {
        return;
    }

    let y_bot = d[0].1.max(0.0).min(g.wall_h);
    let y_shoulder = d[2].1.max(0.0).min(g.wall_h);
    let y_top = if matches!(p.door, DoorMode::Pentagon) {
        d[3].1.max(0.0).min(g.wall_h)
    } else {
        d[2].1.max(0.0).min(g.wall_h)
    };

    let bottom = vec![
        (wall_left_x(g, 0.0), 0.0),
        (wall_right_x(g, 0.0), 0.0),
        (wall_right_x(g, y_bot), y_bot),
        d[1],
        d[0],
        (wall_left_x(g, y_bot), y_bot),
    ];
    add_extruded_poly_if_valid(mesh, &bottom, depth, tx, ty, tz, &[]);

    let right_side = vec![
        d[1],
        (wall_right_x(g, y_bot), y_bot),
        (wall_right_x(g, y_shoulder), y_shoulder),
        d[2],
    ];
    add_extruded_poly_if_valid(mesh, &right_side, depth, tx, ty, tz, &[]);

    let left_side = vec![
        (wall_left_x(g, y_bot), y_bot),
        d[0],
        d[d.len() - 1],
        (wall_left_x(g, y_shoulder), y_shoulder),
    ];
    add_extruded_poly_if_valid(mesh, &left_side, depth, tx, ty, tz, &[]);

    if matches!(p.door, DoorMode::Pentagon) {
        let left_peak = vec![
            (wall_left_x(g, y_shoulder), y_shoulder),
            d[4],
            d[3],
            (wall_left_x(g, y_top), y_top),
        ];
        add_extruded_poly_if_valid(mesh, &left_peak, depth, tx, ty, tz, &[]);

        let right_peak = vec![
            d[3],
            d[2],
            (wall_right_x(g, y_shoulder), y_shoulder),
            (wall_right_x(g, y_top), y_top),
        ];
        add_extruded_poly_if_valid(mesh, &right_peak, depth, tx, ty, tz, &[]);

        let top = vec![
            (wall_left_x(g, y_top), y_top),
            d[3],
            (wall_right_x(g, y_top), y_top),
            (wall_right_x(g, g.wall_h), g.wall_h),
            (wall_left_x(g, g.wall_h), g.wall_h),
        ];
        add_extruded_poly_if_valid(mesh, &top, depth, tx, ty, tz, &[3]);
    } else {
        let top = vec![
            (wall_left_x(g, y_top), y_top),
            d[3],
            d[2],
            (wall_right_x(g, y_top), y_top),
            (wall_right_x(g, g.wall_h), g.wall_h),
            (wall_left_x(g, g.wall_h), g.wall_h),
        ];
        add_extruded_poly_if_valid(mesh, &top, depth, tx, ty, tz, &[4]);
    }
}

fn add_hole_wall_z(mesh: &mut Vec<Tri>, points: &[(f64, f64)], depth: f64, tx: f64, ty: f64, tz: f64) {
    if points.len() < 3 {
        return;
    }
    let dz = depth.max(0.5);
    let v = |x: f64, y: f64, z: f64| transform_point(Vec3 { x: x as f32, y: y as f32, z: z as f32 }, tx, ty, tz, 0.0);
    for i in 0..points.len() {
        let j = (i + 1) % points.len();
        if (points[i].0 - points[j].0).abs() < 0.001 && (points[i].1 - points[j].1).abs() < 0.001 {
            continue;
        }
        let b0 = v(points[i].0, points[i].1, 0.0);
        let b1 = v(points[j].0, points[j].1, 0.0);
        let t0 = v(points[i].0, points[i].1, dz);
        let t1 = v(points[j].0, points[j].1, dz);
        quad(mesh, b1, b0, t0, t1);
    }
}

#[derive(Clone, Copy)]
struct RoundCutout {
    cx: f64,
    cy: f64,
    rx: f64,
    ry: f64,
}

impl RoundCutout {
    fn bottom(&self) -> f64 {
        self.cy - self.ry
    }

    fn top(&self) -> f64 {
        self.cy + self.ry
    }

    fn x_at(&self, y: f64) -> Option<(f64, f64)> {
        let n = ((y - self.cy) / self.ry).clamp(-1.0, 1.0);
        if n.abs() > 1.0 {
            return None;
        }
        let dx = self.rx * (1.0 - n * n).max(0.0).sqrt();
        Some((self.cx - dx, self.cx + dx))
    }
}

fn full_wall_span_poly(g: &GeometryPayload, y0: f64, y1: f64, bottom_x: Option<f64>, top_x: Option<f64>) -> Vec<(f64, f64)> {
    let mut pts = Vec::new();
    pts.push((wall_left_x(g, y0), y0));
    if let Some(x) = bottom_x {
        pts.push((x, y0));
    }
    pts.push((wall_right_x(g, y0), y0));
    pts.push((wall_right_x(g, y1), y1));
    if let Some(x) = top_x {
        pts.push((x, y1));
    }
    pts.push((wall_left_x(g, y1), y1));
    pts
}

fn round_cutout_bands(hole: RoundCutout, segments: usize) -> Vec<(f64, f64, f64)> {
    let mut bands = Vec::new();
    for i in 0..=segments {
        let f = i as f64 / segments as f64;
        let y = hole.bottom() + (hole.top() - hole.bottom()) * f;
        if let Some((lx, rx)) = hole.x_at(y) {
            bands.push((y, lx, rx));
        }
    }
    bands
}

fn add_facade_with_round_door(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload, depth: f64, tx: f64, ty: f64, tz: f64) {
    let (cx, cy) = door_center(p, g);
    let mut holes = vec![RoundCutout {
        cx,
        cy,
        rx: (p.door_w.max(0.5) / 2.0).max(0.25),
        ry: (p.door_h.max(0.5) / 2.0).max(0.25),
    }];

    if p.perch && !matches!(p.door, DoorMode::None) {
        let (px, py) = perch_center(p, g);
        holes.push(RoundCutout {
            cx: px,
            cy: py,
            rx: (p.perch_diam.max(0.5) / 2.0).max(0.25),
            ry: (p.perch_diam.max(0.5) / 2.0).max(0.25),
        });
    }

    holes.sort_by(|a, b| a.bottom().partial_cmp(&b.bottom()).unwrap_or(std::cmp::Ordering::Equal));

    let segments = 32usize;
    for hole in &holes {
        if hole.bottom() <= 0.0 || hole.top() >= g.wall_h {
            return;
        }
        for (y, lx, rx) in round_cutout_bands(*hole, segments) {
            if lx <= wall_left_x(g, y) + 0.001 || rx >= wall_right_x(g, y) - 0.001 {
                return;
            }
        }
    }
    for pair in holes.windows(2) {
        if pair[0].top() >= pair[1].bottom() - 0.001 {
            return;
        }
    }

    let gable_poly = vec![
        (-g.w_top / 2.0, g.wall_h),
        (g.w_top / 2.0, g.wall_h),
        (0.0, g.wall_h + g.roof_h),
    ];
    add_extruded_polygon_z_skip_edges(mesh, &gable_poly, depth, tx, ty, tz, 0.0, &[0]);

    let first = holes[0];
    let bottom = full_wall_span_poly(g, 0.0, first.bottom(), None, Some(first.cx));
    add_extruded_poly_if_valid(mesh, &bottom, depth, tx, ty, tz, &[]);

    for (idx, hole) in holes.iter().enumerate() {
        let bands = round_cutout_bands(*hole, segments);
        for i in 0..segments {
            let (ya, lxa, rxa) = bands[i];
            let (yb, lxb, rxb) = bands[i + 1];
            let left = vec![
                (wall_left_x(g, ya), ya),
                (lxa, ya),
                (lxb, yb),
                (wall_left_x(g, yb), yb),
            ];
            add_extruded_poly_if_valid(mesh, &left, depth, tx, ty, tz, &[]);

            let right = vec![
                (rxa, ya),
                (wall_right_x(g, ya), ya),
                (wall_right_x(g, yb), yb),
                (rxb, yb),
            ];
            add_extruded_poly_if_valid(mesh, &right, depth, tx, ty, tz, &[]);
        }

        let mut hole_wall = Vec::<(f64, f64)>::new();
        let mut push_hole = |pt: (f64, f64)| {
            if hole_wall
                .last()
                .map(|last| (last.0 - pt.0).abs() > 0.001 || (last.1 - pt.1).abs() > 0.001)
                .unwrap_or(true)
            {
                hole_wall.push(pt);
            }
        };
        for (y, _, rxp) in &bands {
            push_hole((*rxp, *y));
        }
        for (y, lx, _) in bands.iter().rev() {
            push_hole((*lx, *y));
        }
        add_hole_wall_z(mesh, &hole_wall, depth, tx, ty, tz);

        if let Some(next) = holes.get(idx + 1) {
            let middle = full_wall_span_poly(g, hole.top(), next.bottom(), Some(hole.cx), Some(next.cx));
            add_extruded_poly_if_valid(mesh, &middle, depth, tx, ty, tz, &[]);
        }
    }

    let last = holes[holes.len() - 1];
    let top = full_wall_span_poly(g, last.top(), g.wall_h, Some(last.cx), None);
    add_extruded_poly_if_valid(mesh, &top, depth, tx, ty, tz, &[]);
}

fn add_facade_with_cutouts(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload, depth: f64, tx: f64, ty: f64, tz: f64) {
    if matches!(p.door, DoorMode::None) && !p.perch {
        add_extruded_polygon_z(mesh, &facade_points(g), depth, tx, ty, tz, 0.0);
        return;
    }

    let holes = facade_holes(p, g);
    if !holes.is_empty() && add_extruded_shape_with_holes_z(mesh, &facade_points(g), &holes, depth, tx, ty, tz) {
        return;
    }

    if false && matches!(p.door, DoorMode::Round) {
        let before = mesh.len();
        add_facade_with_round_door(mesh, p, g, depth, tx, ty, tz);
        if mesh.len() > before {
            return;
        }
    }

    if false && !p.perch && matches!(p.door, DoorMode::Square | DoorMode::Pentagon) {
        add_facade_with_polygon_door(mesh, p, g, depth, tx, ty, tz);
        return;
    }

    let wall_poly = vec![
        (-g.w_bot / 2.0, 0.0),
        (g.w_bot / 2.0, 0.0),
        (g.w_top / 2.0, g.wall_h),
        (-g.w_top / 2.0, g.wall_h),
    ];
    let gable_poly = vec![
        (-g.w_top / 2.0, g.wall_h),
        (g.w_top / 2.0, g.wall_h),
        (0.0, g.wall_h + g.roof_h),
    ];
    // Keep the roof peak exact, but do not create a side wall on the shared
    // wall/gable boundary. In v16 this is one THREE.Shape with a hole, not two
    // solids separated by an internal horizontal face.
    add_extruded_polygon_z_skip_edges(mesh, &gable_poly, depth, tx, ty, tz, 0.0, &[0]);

    let min_x = -g.w_bot.max(g.w_top) / 2.0;
    let max_x = g.w_bot.max(g.w_top) / 2.0;
    let min_y = 0.0;
    let max_y = g.wall_h;
    let step = 2.0;
    let mut xs = vec![min_x, max_x, -g.w_bot / 2.0, g.w_bot / 2.0, -g.w_top / 2.0, g.w_top / 2.0, 0.0];
    let mut ys = vec![min_y, max_y];

    if !matches!(p.door, DoorMode::None) {
        let (cx, cy) = door_center(p, g);
        add_line_sorted(&mut xs, cx - p.door_w / 2.0);
        add_line_sorted(&mut xs, cx + p.door_w / 2.0);
        add_line_sorted(&mut xs, cx);
        add_line_sorted(&mut ys, cy - p.door_h / 2.0);
        add_line_sorted(&mut ys, cy + p.door_h / 2.0);
        add_line_sorted(&mut ys, cy);
        if matches!(p.door, DoorMode::Round) {
            for i in 0..96 {
                let a = (i as f64 / 96.0) * PI * 2.0;
                add_line_sorted(&mut xs, cx + a.cos() * p.door_w / 2.0);
                add_line_sorted(&mut ys, cy + a.sin() * p.door_h / 2.0);
            }
        } else {
            for (x, y) in door_hole_points(p, g) {
                add_line_sorted(&mut xs, x);
                add_line_sorted(&mut ys, y);
            }
        }
    }

    if p.perch && !matches!(p.door, DoorMode::None) {
        let (perch_x, perch_y) = perch_center(p, g);
        add_line_sorted(&mut ys, perch_y - p.perch_diam / 2.0);
        add_line_sorted(&mut ys, perch_y + p.perch_diam / 2.0);
        add_line_sorted(&mut ys, perch_y);
        add_line_sorted(&mut xs, perch_x - p.perch_diam / 2.0);
        add_line_sorted(&mut xs, perch_x + p.perch_diam / 2.0);
        add_line_sorted(&mut xs, perch_x);
        for i in 0..48 {
            let a = (i as f64 / 48.0) * PI * 2.0;
            add_line_sorted(&mut xs, perch_x + a.cos() * p.perch_diam / 2.0);
            add_line_sorted(&mut ys, perch_y + a.sin() * p.perch_diam / 2.0);
        }
    }

    let mut x = min_x;
    while x <= max_x {
        add_line_sorted(&mut xs, x);
        x += step;
    }
    let mut y = min_y;
    while y <= max_y {
        add_line_sorted(&mut ys, y);
        y += step;
    }
    let xs = sorted_dedup(xs);
    let ys = sorted_dedup(ys);
    if xs.len() < 2 || ys.len() < 2 {
        add_extruded_polygon_z(mesh, &wall_poly, depth, tx, ty, tz, 0.0);
        return;
    }

    let nx = xs.len() - 1;
    let ny = ys.len() - 1;
    let mut keep = vec![false; nx * ny];
    for iy in 0..ny {
        for ix in 0..nx {
            let cx = (xs[ix] + xs[ix + 1]) / 2.0;
            let cy = (ys[iy] + ys[iy + 1]) / 2.0;
            keep[iy * nx + ix] = point_in_poly(cx, cy, &wall_poly) && !point_in_cutout(p, g, cx, cy);
        }
    }

    let kept = |ix: isize, iy: isize, keep: &[bool]| -> bool {
        if ix < 0 || iy < 0 || ix >= nx as isize || iy >= ny as isize {
            return false;
        }
        keep[iy as usize * nx + ix as usize]
    };

    let v = |x: f64, y: f64, z: f64| transform_point(Vec3 { x: x as f32, y: y as f32, z: z as f32 }, tx, ty, tz, 0.0);
    let dz = depth.max(0.5);
    for iy in 0..ny {
        for ix in 0..nx {
            if !keep[iy * nx + ix] {
                continue;
            }
            let x0 = xs[ix];
            let x1 = xs[ix + 1];
            let y0 = ys[iy];
            let y1 = ys[iy + 1];
            let b00 = v(x0, y0, 0.0);
            let b10 = v(x1, y0, 0.0);
            let b11 = v(x1, y1, 0.0);
            let b01 = v(x0, y1, 0.0);
            let t00 = v(x0, y0, dz);
            let t10 = v(x1, y0, dz);
            let t11 = v(x1, y1, dz);
            let t01 = v(x0, y1, dz);

            quad(mesh, b00, b10, b11, b01);
            quad(mesh, t00, t01, t11, t10);
            if !kept(ix as isize - 1, iy as isize, &keep) {
                quad(mesh, b00, b01, t01, t00);
            }
            if !kept(ix as isize + 1, iy as isize, &keep) {
                quad(mesh, b10, t10, t11, b11);
            }
            if !kept(ix as isize, iy as isize - 1, &keep) {
                quad(mesh, b00, t00, t10, b10);
            }
            if !kept(ix as isize, iy as isize + 1, &keep) && (y1 - max_y).abs() > 0.001 {
                quad(mesh, b01, b11, t11, t01);
            }
        }
    }
}

fn facade_points(g: &GeometryPayload) -> Vec<(f64, f64)> {
    vec![
        (-g.w_bot / 2.0, 0.0),
        (g.w_bot / 2.0, 0.0),
        (g.w_top / 2.0, g.wall_h),
        (0.0, g.wall_h + g.roof_h),
        (-g.w_top / 2.0, g.wall_h),
    ]
}

fn door_points(p: &NichoirParams) -> Vec<(f64, f64)> {
    let w = p.door_w.max(0.5) * (p.door_var / 100.0).max(0.0);
    let h = p.door_h.max(0.5) * (p.door_var / 100.0).max(0.0);
    match p.door {
        DoorMode::Pentagon => {
            let peak_h = w * 0.35;
            let box_h = (h - peak_h).max(h * 0.5);
            vec![
                (-w / 2.0, -h / 2.0),
                (w / 2.0, -h / 2.0),
                (w / 2.0, -h / 2.0 + box_h),
                (0.0, h / 2.0),
                (-w / 2.0, -h / 2.0 + box_h),
            ]
        }
        DoorMode::Round => {
            let mut pts = Vec::new();
            for i in 0..40 {
                let a = (i as f64 / 40.0) * PI * 2.0;
                pts.push((a.cos() * w / 2.0, a.sin() * h / 2.0));
            }
            pts
        }
        DoorMode::Square | DoorMode::None => vec![
            (-w / 2.0, -h / 2.0),
            (w / 2.0, -h / 2.0),
            (w / 2.0, h / 2.0),
            (-w / 2.0, h / 2.0),
        ],
    }
}

fn roof_miter_points(p: &NichoirParams, g: &GeometryPayload, left: bool) -> Vec<(f64, f64)> {
    let ang = p.slope * PI / 180.0;
    let bev = p.t * ang.tan();
    if left {
        vec![(0.0, 0.0), (-g.s_l, 0.0), (-g.s_l, p.t), (bev, p.t)]
    } else {
        vec![(0.0, 0.0), (g.s_l, 0.0), (g.s_l, p.t), (-bev, p.t)]
    }
}

#[derive(Clone, Copy)]
struct RoofHole {
    x: f64,
    z: f64,
    r: f64,
}

fn roof_hole_list(p: &NichoirParams, g: &GeometryPayload, left: bool) -> Vec<RoofHole> {
    if !p.hang_holes {
        return Vec::new();
    }
    let profile = roof_profile_points(p, g, left);
    if profile.is_empty() {
        return Vec::new();
    }
    let min_x = profile.iter().map(|pt| pt.0).fold(f64::INFINITY, f64::min);
    let max_x = profile.iter().map(|pt| pt.0).fold(f64::NEG_INFINITY, f64::max);
    let side_offset = p.hang_side_offset.clamp(2.0, g.s_l.max(2.0));
    let end_offset = p.hang_end_offset.clamp(2.0, (g.roof_len / 2.0).max(2.0));
    let r = (p.hang_diam / 2.0).clamp(1.0, 25.0);
    let x = if left { min_x + side_offset } else { max_x - side_offset };
    let z_front = g.roof_len - end_offset;
    let z_back = end_offset;
    let mut out = Vec::new();
    if left && p.hang_fl {
        out.push(RoofHole { x, z: z_front, r });
    }
    if left && p.hang_bl {
        out.push(RoofHole { x, z: z_back, r });
    }
    if !left && p.hang_fr {
        out.push(RoofHole { x, z: z_front, r });
    }
    if !left && p.hang_br {
        out.push(RoofHole { x, z: z_back, r });
    }
    out
}

fn roof_y_range_at_x(profile: &[(f64, f64)], x: f64) -> Option<(f64, f64)> {
    let mut ys = Vec::new();
    for i in 0..profile.len() {
        let j = (i + 1) % profile.len();
        let (x0, y0) = profile[i];
        let (x1, y1) = profile[j];
        if (x0 - x1).abs() < 0.000001 {
            if (x - x0).abs() < 0.0005 {
                ys.push(y0);
                ys.push(y1);
            }
            continue;
        }
        let min_x = x0.min(x1) - 0.0005;
        let max_x = x0.max(x1) + 0.0005;
        if x >= min_x && x <= max_x {
            let t = ((x - x0) / (x1 - x0)).clamp(0.0, 1.0);
            ys.push(y0 + (y1 - y0) * t);
        }
    }
    if ys.len() < 2 {
        return None;
    }
    ys.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    Some((*ys.first().unwrap(), *ys.last().unwrap()))
}

fn in_roof_hole(x: f64, z: f64, holes: &[RoofHole]) -> bool {
    holes.iter().any(|h| {
        let dx = x - h.x;
        let dz = z - h.z;
        dx * dx + dz * dz <= h.r * h.r
    })
}

fn add_roof_panel_with_holes(
    mesh: &mut Vec<Tri>,
    p: &NichoirParams,
    g: &GeometryPayload,
    left: bool,
    tx: f64,
    ty: f64,
    tz: f64,
    rz: f64,
) {
    let profile = roof_profile_points(p, g, left);
    let holes = roof_hole_list(p, g, left);
    if holes.is_empty() {
        add_extruded_polygon_z(mesh, &profile, g.roof_len.max(0.5), tx, ty, tz, rz);
        return;
    }

    let min_x = profile.iter().map(|pt| pt.0).fold(f64::INFINITY, f64::min);
    let max_x = profile.iter().map(|pt| pt.0).fold(f64::NEG_INFINITY, f64::max);
    let min_z = 0.0;
    let max_z = g.roof_len;
    let step = (p.hang_diam / 4.0).clamp(3.0, 8.0);
    let mut xs = vec![min_x, max_x];
    let mut zs = vec![min_z, max_z];
    for (x, _) in &profile {
        add_line_sorted(&mut xs, *x);
    }
    for h in &holes {
        let mut x = (h.x - h.r * 1.4).max(min_x);
        while x <= (h.x + h.r * 1.4).min(max_x) {
            add_line_sorted(&mut xs, x);
            x += step;
        }
        let mut z = (h.z - h.r * 1.4).max(min_z);
        while z <= (h.z + h.r * 1.4).min(max_z) {
            add_line_sorted(&mut zs, z);
            z += step;
        }
        for i in 0..32 {
            let a = i as f64 / 32.0 * PI * 2.0;
            add_line_sorted(&mut xs, (h.x + a.cos() * h.r).clamp(min_x, max_x));
            add_line_sorted(&mut zs, (h.z + a.sin() * h.r).clamp(min_z, max_z));
        }
    }
    let mut x = min_x;
    while x <= max_x {
        add_line_sorted(&mut xs, x);
        x += step * 5.0;
    }
    let mut z = min_z;
    while z <= max_z {
        add_line_sorted(&mut zs, z);
        z += step * 5.0;
    }
    let xs = sorted_dedup(xs);
    let zs = sorted_dedup(zs);
    if xs.len() < 2 || zs.len() < 2 {
        add_extruded_polygon_z(mesh, &profile, g.roof_len.max(0.5), tx, ty, tz, rz);
        return;
    }
    let nx = xs.len() - 1;
    let nz = zs.len() - 1;
    let mut keep = vec![false; nx * nz];
    for iz in 0..nz {
        for ix in 0..nx {
            let cx = (xs[ix] + xs[ix + 1]) / 2.0;
            let cz = (zs[iz] + zs[iz + 1]) / 2.0;
            keep[iz * nx + ix] = roof_y_range_at_x(&profile, cx).is_some() && !in_roof_hole(cx, cz, &holes);
        }
    }
    let kept = |ix: isize, iz: isize, keep: &[bool]| -> bool {
        if ix < 0 || iz < 0 || ix >= nx as isize || iz >= nz as isize {
            return false;
        }
        keep[iz as usize * nx + ix as usize]
    };
    let local = |x: f64, y: f64, z: f64| transform_point(Vec3 { x: x as f32, y: y as f32, z: z as f32 }, tx, ty, tz, rz);

    for iz in 0..nz {
        for ix in 0..nx {
            if !keep[iz * nx + ix] {
                continue;
            }
            let x0 = xs[ix];
            let x1 = xs[ix + 1];
            let z0 = zs[iz];
            let z1 = zs[iz + 1];
            let Some((b0, t0)) = roof_y_range_at_x(&profile, x0) else { continue };
            let Some((b1, t1)) = roof_y_range_at_x(&profile, x1) else { continue };
            let b00 = local(x0, b0, z0);
            let b01 = local(x0, b0, z1);
            let b10 = local(x1, b1, z0);
            let b11 = local(x1, b1, z1);
            let t00 = local(x0, t0, z0);
            let t01 = local(x0, t0, z1);
            let t10 = local(x1, t1, z0);
            let t11 = local(x1, t1, z1);

            quad(mesh, t00, t10, t11, t01);
            quad(mesh, b00, b01, b11, b10);
            if !kept(ix as isize - 1, iz as isize, &keep) {
                quad(mesh, b00, t00, t01, b01);
            }
            if !kept(ix as isize + 1, iz as isize, &keep) {
                quad(mesh, b10, b11, t11, t10);
            }
            if !kept(ix as isize, iz as isize - 1, &keep) {
                quad(mesh, b00, b10, t10, t00);
            }
            if !kept(ix as isize, iz as isize + 1, &keep) {
                quad(mesh, b01, t01, t11, b11);
            }
        }
    }
}

fn roof_profile_points(p: &NichoirParams, g: &GeometryPayload, left: bool) -> Vec<(f64, f64)> {
    let ridge = effective_ridge(p);
    if matches!(ridge, RidgeMode::Miter) {
        return roof_miter_points(p, g, left);
    }

    if left {
        if matches!(ridge, RidgeMode::Left) {
            vec![(p.t, 0.0), (-g.s_l, 0.0), (-g.s_l, p.t), (p.t, p.t)]
        } else {
            vec![(0.0, 0.0), (-g.s_l, 0.0), (-g.s_l, p.t), (0.0, p.t)]
        }
    } else if matches!(ridge, RidgeMode::Right) {
        vec![(-p.t, 0.0), (g.s_l, 0.0), (g.s_l, p.t), (-p.t, p.t)]
    } else {
        vec![(0.0, 0.0), (g.s_l, 0.0), (g.s_l, p.t), (0.0, p.t)]
    }
}

fn poly_bounds(points: &[(f64, f64)]) -> (f64, f64) {
    if points.is_empty() {
        return (0.0, 0.0);
    }
    let mut min_x = points[0].0;
    let mut max_x = points[0].0;
    let mut min_y = points[0].1;
    let mut max_y = points[0].1;
    for (x, y) in points {
        min_x = min_x.min(*x);
        max_x = max_x.max(*x);
        min_y = min_y.min(*y);
        max_y = max_y.max(*y);
    }
    ((max_x - min_x).abs(), (max_y - min_y).abs())
}

fn build_house_tris(p: &NichoirParams) -> Vec<Tri> {
    let g = GeometryPayload::from_p(p);
    let ang = p.slope * PI / 180.0;
    let base_y = if matches!(p.floor, FloorMode::Pose) { p.t } else { 0.0 };
    let peak_y = base_y + g.wall_h + g.roof_h;
    let roof_len = g.roof_len.max(0.5);
    let mut tris = Vec::<Tri>::new();

    add_facade_with_cutouts(&mut tris, p, &g, p.t, 0.0, base_y, p.d / 2.0 - p.t);
    add_back_panel_with_mount_holes(&mut tris, p, &g, p.t, 0.0, base_y, -p.d / 2.0);
    if p.wall_mount {
        add_wall_mount_block(&mut tris, p, &g, base_y, -p.d / 2.0 - wall_mount_depth(p), true);
    }

    add_side_walls(&mut tris, p, &g, base_y);
    add_floor_panel(&mut tris, p, &g);

    add_roof_panel_with_holes(&mut tris, p, &g, true, 0.0, peak_y, -roof_len / 2.0, ang);
    add_roof_panel_with_holes(&mut tris, p, &g, false, 0.0, peak_y, -roof_len / 2.0, -ang);

    if !matches!(p.door, DoorMode::None) && p.door_panel {
        let door_y = base_y + p.door_py / 100.0 * g.wall_h;
        let door_w_local = g.w_bot - 2.0 * p.taper_x * (p.door_py / 100.0);
        let door_x = -door_w_local / 2.0 + p.door_px / 100.0 * door_w_local;
        let pts = door_points(p);
        add_extruded_polygon_z(&mut tris, &pts, p.t, door_x, door_y, p.d / 2.0 + 1.0, 0.0);
    }

    if p.perch && !matches!(p.door, DoorMode::None) {
        let (perch_x, perch_y) = perch_center(p, &g);
        add_cylinder_z(
            &mut tris,
            perch_x,
            base_y + perch_y,
            p.d / 2.0,
            p.perch_diam / 2.0,
            p.perch_len,
            32,
        );
    }

    tris.extend(build_all_decor_tris(p, &g));

    clean_tris(tris)
}

fn write_stl(label: &str, tris: &[Tri]) -> Vec<u8> {
    let mut out = Vec::with_capacity(80 + 4 + tris.len() * 50);
    let mut header = [0u8; 80];
    let bytes = label.as_bytes();
    let len = bytes.len().min(80);
    header[..len].copy_from_slice(&bytes[..len]);
    out.extend_from_slice(&header);

    let tri_count = tris.len() as u32;
    out.extend_from_slice(&tri_count.to_le_bytes());

    for t in tris {
        for v in [&t.normal, &t.a, &t.b, &t.c] {
            out.extend_from_slice(&v.x.to_le_bytes());
            out.extend_from_slice(&v.y.to_le_bytes());
            out.extend_from_slice(&v.z.to_le_bytes());
        }
        out.extend_from_slice(&0u16.to_le_bytes());
    }

    out
}

fn write_obj(label: &str, tris: &[Tri]) -> String {
    let mut out = String::new();
    out.push_str(&format!("# Nichoir OBJ debug: {label}\n"));
    out.push_str("o nichoir\n");
    for t in tris {
        for v in [t.a, t.b, t.c] {
            out.push_str(&format!("v {:.6} {:.6} {:.6}\n", v.x, v.y, v.z));
        }
    }
    for (i, _) in tris.iter().enumerate() {
        let base = i * 3 + 1;
        out.push_str(&format!("f {} {} {}\n", base, base + 1, base + 2));
    }
    out
}

#[derive(Serialize)]
struct MeshReport {
    name: String,
    triangles: usize,
    stl_bytes: usize,
    obj_bytes: usize,
    degenerate_triangles: usize,
    non_finite_values: usize,
    bbox_min: [f32; 3],
    bbox_max: [f32; 3],
    dimensions: [f32; 3],
    signed_volume_mm3: f64,
    warnings: Vec<String>,
}

#[derive(Serialize)]
struct ZipEntryReport {
    name: String,
    bytes: usize,
}

#[derive(Serialize)]
struct MeshReportPayload {
    house: MeshReport,
    parts: Vec<MeshReport>,
    zip_bytes: usize,
    zip_entries: Vec<ZipEntryReport>,
}

fn tri_area2(t: &Tri) -> f64 {
    let ab = sub(t.b, t.a);
    let ac = sub(t.c, t.a);
    let c = cross(ab, ac);
    ((c.x as f64).powi(2) + (c.y as f64).powi(2) + (c.z as f64).powi(2)).sqrt()
}

fn tri_is_finite(t: &Tri) -> bool {
    [t.normal, t.a, t.b, t.c]
        .iter()
        .all(|v| v.x.is_finite() && v.y.is_finite() && v.z.is_finite())
}

fn clean_tris(tris: Vec<Tri>) -> Vec<Tri> {
    tris.into_iter()
        .filter(|t| tri_is_finite(t) && tri_area2(t) >= 0.000_001)
        .collect()
}

fn signed_volume(tris: &[Tri]) -> f64 {
    let mut volume = 0.0;
    for t in tris {
        let ax = t.a.x as f64;
        let ay = t.a.y as f64;
        let az = t.a.z as f64;
        let bx = t.b.x as f64;
        let by = t.b.y as f64;
        let bz = t.b.z as f64;
        let cx = t.c.x as f64;
        let cy = t.c.y as f64;
        let cz = t.c.z as f64;
        volume += (ax * (by * cz - bz * cy)
            - ay * (bx * cz - bz * cx)
            + az * (bx * cy - by * cx))
            / 6.0;
    }
    volume
}

fn analyze_mesh(name: &str, tris: &[Tri]) -> MeshReport {
    let mut min = [f32::INFINITY; 3];
    let mut max = [f32::NEG_INFINITY; 3];
    let mut non_finite_values = 0usize;
    let mut degenerate_triangles = 0usize;

    for t in tris {
        if tri_area2(t) < 0.000_001 {
            degenerate_triangles += 1;
        }
        for v in [t.a, t.b, t.c] {
            for (idx, value) in [v.x, v.y, v.z].iter().copied().enumerate() {
                if value.is_finite() {
                    min[idx] = min[idx].min(value);
                    max[idx] = max[idx].max(value);
                } else {
                    non_finite_values += 1;
                }
            }
        }
    }

    if tris.is_empty() {
        min = [0.0; 3];
        max = [0.0; 3];
    }

    let dimensions = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    let mut warnings = Vec::new();
    if tris.is_empty() {
        warnings.push("mesh vide".to_string());
    }
    if non_finite_values > 0 {
        warnings.push("valeurs non finies detectees".to_string());
    }
    if degenerate_triangles > 0 {
        warnings.push("triangles degeneres detectes".to_string());
    }

    MeshReport {
        name: name.to_string(),
        triangles: tris.len(),
        stl_bytes: 84 + tris.len() * 50,
        obj_bytes: write_obj(name, tris).len(),
        degenerate_triangles,
        non_finite_values,
        bbox_min: min,
        bbox_max: max,
        dimensions,
        signed_volume_mm3: signed_volume(tris),
        warnings,
    }
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffffu32;
    for &b in bytes {
        crc ^= b as u32;
        for _ in 0..8 {
            let mask = if crc & 1 == 1 { 0xedb8_8320 } else { 0 };
            crc = (crc >> 1) ^ mask;
        }
    }
    !crc
}

fn push_u16(out: &mut Vec<u8>, v: u16) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn push_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn write_zip(entries: Vec<(String, Vec<u8>)>) -> Vec<u8> {
    let mut out = Vec::new();
    let mut central = Vec::new();

    for (name, data) in entries {
        let name_bytes = name.as_bytes();
        let crc = crc32(&data);
        let local_offset = out.len() as u32;

        push_u32(&mut out, 0x0403_4b50);
        push_u16(&mut out, 20);
        push_u16(&mut out, 0);
        push_u16(&mut out, 0);
        push_u16(&mut out, 0);
        push_u16(&mut out, 0);
        push_u32(&mut out, crc);
        push_u32(&mut out, data.len() as u32);
        push_u32(&mut out, data.len() as u32);
        push_u16(&mut out, name_bytes.len() as u16);
        push_u16(&mut out, 0);
        out.extend_from_slice(name_bytes);
        out.extend_from_slice(&data);

        push_u32(&mut central, 0x0201_4b50);
        push_u16(&mut central, 20);
        push_u16(&mut central, 20);
        push_u16(&mut central, 0);
        push_u16(&mut central, 0);
        push_u16(&mut central, 0);
        push_u16(&mut central, 0);
        push_u32(&mut central, crc);
        push_u32(&mut central, data.len() as u32);
        push_u32(&mut central, data.len() as u32);
        push_u16(&mut central, name_bytes.len() as u16);
        push_u16(&mut central, 0);
        push_u16(&mut central, 0);
        push_u16(&mut central, 0);
        push_u16(&mut central, 0);
        push_u32(&mut central, 0);
        push_u32(&mut central, local_offset);
        central.extend_from_slice(name_bytes);
    }

    let central_offset = out.len() as u32;
    let central_len = central.len() as u32;
    let entry_count = {
        let mut count = 0u16;
        let mut i = 0usize;
        while i + 4 <= central.len() {
            if central[i..i + 4] == [0x50, 0x4b, 0x01, 0x02] {
                count += 1;
            }
            i += 1;
        }
        count
    };

    out.extend_from_slice(&central);
    push_u32(&mut out, 0x0605_4b50);
    push_u16(&mut out, 0);
    push_u16(&mut out, 0);
    push_u16(&mut out, entry_count);
    push_u16(&mut out, entry_count);
    push_u32(&mut out, central_len);
    push_u32(&mut out, central_offset);
    push_u16(&mut out, 0);
    out
}

fn front_panel_tris(p: &NichoirParams, g: &GeometryPayload) -> Vec<Tri> {
    let mut tris = Vec::<Tri>::new();
    add_facade_with_cutouts(&mut tris, p, g, p.t, 0.0, 0.0, 0.0);
    clean_tris(tris)
}

fn add_back_panel_with_mount_holes(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload, depth: f64, tx: f64, ty: f64, tz: f64) {
    let facade = facade_points(g);
    let holes = wall_mount_holes(p, g);
    if !holes.is_empty() && add_extruded_shape_with_holes_z(mesh, &facade, &holes, depth, tx, ty, tz) {
        return;
    }
    add_extruded_polygon_z(mesh, &facade, depth, tx, ty, tz, 0.0);
}

fn back_panel_tris(p: &NichoirParams, g: &GeometryPayload) -> Vec<Tri> {
    let mut tris = Vec::<Tri>::new();
    add_back_panel_with_mount_holes(&mut tris, p, g, p.t, 0.0, 0.0, 0.0);
    clean_tris(tris)
}

fn add_wall_mount_shed_cap(mesh: &mut Vec<Tri>, m: &WallMountGeometry, cy: f64, z_start: f64) {
    let inset = WALL_MOUNT_SHED_INSET
        .min(m.block_w * 0.1)
        .min(m.block_depth * 0.1);
    let x0 = -m.block_w / 2.0 + inset;
    let x1 = m.block_w / 2.0 - inset;
    let z0 = z_start + inset;
    let z1 = z_start + m.block_depth - inset;
    let y_base = cy + m.block_h / 2.0;
    let y_exterior = y_base + WALL_MOUNT_SHED_EDGE_THICKNESS;
    let y_wall = y_exterior + wall_mount_shed_rise(m);

    let p00 = Vec3 { x: x0 as f32, y: y_base as f32, z: z0 as f32 };
    let p10 = Vec3 { x: x1 as f32, y: y_base as f32, z: z0 as f32 };
    let p11 = Vec3 { x: x1 as f32, y: y_base as f32, z: z1 as f32 };
    let p01 = Vec3 { x: x0 as f32, y: y_base as f32, z: z1 as f32 };
    let q00 = Vec3 { x: x0 as f32, y: y_exterior as f32, z: z0 as f32 };
    let q10 = Vec3 { x: x1 as f32, y: y_exterior as f32, z: z0 as f32 };
    let q11 = Vec3 { x: x1 as f32, y: y_wall as f32, z: z1 as f32 };
    let q01 = Vec3 { x: x0 as f32, y: y_wall as f32, z: z1 as f32 };

    quad(mesh, p00, p01, p11, p10);
    quad(mesh, q00, q10, q11, q01);
    quad(mesh, p00, p10, q10, q00);
    quad(mesh, p01, q01, q11, p11);
    quad(mesh, p00, q00, q01, p01);
    quad(mesh, p10, p11, q11, q10);
}

fn add_wall_mount_block(mesh: &mut Vec<Tri>, p: &NichoirParams, g: &GeometryPayload, base_y: f64, z_start: f64, placed: bool) {
    if !p.wall_mount {
        return;
    }
    let m = wall_mount_geometry(p, g);
    let cy = if placed { base_y + m.y } else { 0.0 };
    let outer = vec![
        (-m.block_w / 2.0, cy - m.block_h / 2.0),
        (m.block_w / 2.0, cy - m.block_h / 2.0),
        (m.block_w / 2.0, cy + m.block_h / 2.0),
        (-m.block_w / 2.0, cy + m.block_h / 2.0),
    ];
    let hole_y = cy;
    let half = m.hole_spacing / 2.0;
    let holes = vec![
        ellipse_points(-half, hole_y, m.hole_radius, m.hole_radius, 32),
        ellipse_points(half, hole_y, m.hole_radius, m.hole_radius, 32),
    ];
    if !add_extruded_shape_with_holes_z(mesh, &outer, &holes, m.block_depth, 0.0, 0.0, z_start) {
        add_extruded_polygon_z(mesh, &outer, m.block_depth, 0.0, 0.0, z_start, 0.0);
    }
    add_wall_mount_shed_cap(mesh, &m, cy, z_start);
}

fn wall_mount_block_tris(p: &NichoirParams, g: &GeometryPayload) -> Vec<Tri> {
    let mut tris = Vec::<Tri>::new();
    add_wall_mount_block(&mut tris, p, g, 0.0, 0.0, false);
    clean_tris(tris)
}

fn perch_tris(p: &NichoirParams) -> Vec<Tri> {
    let mut tris = Vec::<Tri>::new();
    add_cylinder_z(
        &mut tris,
        0.0,
        0.0,
        0.0,
        p.perch_diam / 2.0,
        p.perch_len,
        32,
    );
    clean_tris(tris)
}

fn door_panel_tris(p: &NichoirParams) -> Vec<Tri> {
    let mut tris = Vec::<Tri>::new();
    if matches!(p.door, DoorMode::None) || !p.door_panel {
        return tris;
    }
    let v = (p.door_var / 100.0).max(0.0);
    let t = (p.t * v).max(0.5);
    add_extruded_polygon_z(&mut tris, &door_points(p), t, 0.0, 0.0, 0.0, 0.0);
    clean_tris(tris)
}

fn roof_panel_tris(p: &NichoirParams, g: &GeometryPayload, left: bool) -> Vec<Tri> {
    let mut tris = Vec::new();
    add_roof_panel_with_holes(&mut tris, p, g, left, 0.0, 0.0, 0.0, 0.0);
    clean_tris(tris)
}

fn deco_target_keys() -> [&'static str; 6] {
    ["front", "back", "left", "right", "roofL", "roofR"]
}

fn deco_target_label(lang: &str, key: &str) -> &'static str {
    match (lang, key) {
        ("en", "front") => "Front facade",
        ("en", "back") => "Back facade",
        ("en", "left") => "Left side",
        ("en", "right") => "Right side",
        ("en", "roofL") => "Left roof",
        ("en", "roofR") => "Right roof",
        (_, "front") => "Facade avant",
        (_, "back") => "Facade arriere",
        (_, "left") => "Cote gauche",
        (_, "right") => "Cote droit",
        (_, "roofL") => "Toit gauche",
        (_, "roofR") => "Toit droit",
        _ => "Decor",
    }
}

fn deco_for<'a>(p: &'a NichoirParams, key: &str) -> Option<&'a DecorSettings> {
    p.decos.get(key).filter(|d| {
        d.enabled
            && ((d.mode == "heightmap" && !d.source_data.trim().is_empty())
                || (d.source_type == "svg" && !d.source_text.trim().is_empty()))
    })
}

fn deco_basis_for_target(
    p: &NichoirParams,
    g: &GeometryPayload,
    key: &str,
    d: &DecorSettings,
) -> Option<(Vec3, Vec3, Vec3, Vec3)> {
    let base_y = if matches!(p.floor, FloorMode::Pose) { p.t } else { 0.0 };
    let wall_total = (g.wall_h + g.roof_h).max(1.0);
    let eps = 0.08;

    match key {
        "front" => {
            let cx = -g.w_bot / 2.0 + (d.pos_x / 100.0) * g.w_bot;
            let cy = base_y + (d.pos_y / 100.0) * wall_total;
            Some((
                Vec3 { x: cx as f32, y: cy as f32, z: (p.d / 2.0 + eps) as f32 },
                Vec3 { x: 1.0, y: 0.0, z: 0.0 },
                Vec3 { x: 0.0, y: 1.0, z: 0.0 },
                Vec3 { x: 0.0, y: 0.0, z: 1.0 },
            ))
        }
        "back" => {
            let cx = g.w_bot / 2.0 - (d.pos_x / 100.0) * g.w_bot;
            let cy = base_y + (d.pos_y / 100.0) * wall_total;
            Some((
                Vec3 { x: cx as f32, y: cy as f32, z: (-p.d / 2.0 - eps) as f32 },
                Vec3 { x: -1.0, y: 0.0, z: 0.0 },
                Vec3 { x: 0.0, y: 1.0, z: 0.0 },
                Vec3 { x: 0.0, y: 0.0, z: -1.0 },
            ))
        }
        "left" => {
            let v = normalize(Vec3 { x: p.taper_x as f32, y: g.wall_h as f32, z: 0.0 });
            let n = normalize(Vec3 { x: -v.y, y: v.x, z: 0.0 });
            let u = Vec3 { x: 0.0, y: 0.0, z: 1.0 };
            let start = Vec3 {
                x: (-g.w_bot / 2.0) as f32,
                y: base_y as f32,
                z: (-g.side_d / 2.0) as f32,
            };
            let origin = add3(
                add3(add3(start, scale3(u, (d.pos_x / 100.0) * g.side_d)), scale3(v, (d.pos_y / 100.0) * g.wall_h_real)),
                scale3(n, eps),
            );
            Some((origin, u, v, n))
        }
        "right" => {
            let v = normalize(Vec3 { x: (-p.taper_x) as f32, y: g.wall_h as f32, z: 0.0 });
            let n = normalize(Vec3 { x: v.y, y: -v.x, z: 0.0 });
            let u = Vec3 { x: 0.0, y: 0.0, z: -1.0 };
            let start = Vec3 {
                x: (g.w_bot / 2.0) as f32,
                y: base_y as f32,
                z: (g.side_d / 2.0) as f32,
            };
            let origin = add3(
                add3(add3(start, scale3(u, (d.pos_x / 100.0) * g.side_d)), scale3(v, (d.pos_y / 100.0) * g.wall_h_real)),
                scale3(n, eps),
            );
            Some((origin, u, v, n))
        }
        "roofL" | "roofR" => {
            let ang = p.slope * PI / 180.0;
            let peak_y = base_y + g.wall_h + g.roof_h;
            let u = Vec3 { x: 0.0, y: 0.0, z: 1.0 };
            let (v, n) = if key == "roofL" {
                (
                    Vec3 { x: (-ang.cos()) as f32, y: (-ang.sin()) as f32, z: 0.0 },
                    Vec3 { x: (-ang.sin()) as f32, y: ang.cos() as f32, z: 0.0 },
                )
            } else {
                (
                    Vec3 { x: ang.cos() as f32, y: (-ang.sin()) as f32, z: 0.0 },
                    Vec3 { x: ang.sin() as f32, y: ang.cos() as f32, z: 0.0 },
                )
            };
            let start = Vec3 {
                x: 0.0,
                y: peak_y as f32,
                z: (-g.roof_len / 2.0) as f32,
            };
            let origin = add3(
                add3(add3(start, scale3(u, (d.pos_x / 100.0) * g.roof_len)), scale3(v, (d.pos_y / 100.0) * g.s_l)),
                scale3(n, eps),
            );
            Some((origin, u, v, normalize(n)))
        }
        _ => None,
    }
}

fn deco_panel_clip_polygon(
    p: &NichoirParams,
    g: &GeometryPayload,
    key: &str,
    origin: Vec3,
    u: Vec3,
    v: Vec3,
) -> Option<Vec<(f64, f64)>> {
    let base_y = if matches!(p.floor, FloorMode::Pose) { p.t } else { 0.0 };
    let eps = 0.08;
    let project = |pt: Vec3| project_to_deco(origin, u, v, pt);

    match key {
        "front" => Some(
            facade_points(g)
                .into_iter()
                .map(|(x, y)| {
                    project(Vec3 {
                        x: x as f32,
                        y: (base_y + y) as f32,
                        z: (p.d / 2.0 + eps) as f32,
                    })
                })
                .collect(),
        ),
        "back" => Some(
            facade_points(g)
                .into_iter()
                .map(|(x, y)| {
                    project(Vec3 {
                        x: x as f32,
                        y: (base_y + y) as f32,
                        z: (-p.d / 2.0 - eps) as f32,
                    })
                })
                .collect(),
        ),
        "left" => {
            let start = Vec3 {
                x: (-g.w_bot / 2.0) as f32,
                y: base_y as f32,
                z: (-g.side_d / 2.0) as f32,
            };
            let up = normalize(Vec3 { x: p.taper_x as f32, y: g.wall_h as f32, z: 0.0 });
            let along = Vec3 { x: 0.0, y: 0.0, z: 1.0 };
            Some(vec![
                project(start),
                project(add3(start, scale3(along, g.side_d))),
                project(add3(add3(start, scale3(along, g.side_d)), scale3(up, g.wall_h_real))),
                project(add3(start, scale3(up, g.wall_h_real))),
            ])
        }
        "right" => {
            let start = Vec3 {
                x: (g.w_bot / 2.0) as f32,
                y: base_y as f32,
                z: (g.side_d / 2.0) as f32,
            };
            let up = normalize(Vec3 { x: (-p.taper_x) as f32, y: g.wall_h as f32, z: 0.0 });
            let along = Vec3 { x: 0.0, y: 0.0, z: -1.0 };
            Some(vec![
                project(start),
                project(add3(start, scale3(along, g.side_d))),
                project(add3(add3(start, scale3(along, g.side_d)), scale3(up, g.wall_h_real))),
                project(add3(start, scale3(up, g.wall_h_real))),
            ])
        }
        "roofL" | "roofR" => {
            let ang = p.slope * PI / 180.0;
            let peak_y = base_y + g.wall_h + g.roof_h;
            let start = Vec3 {
                x: 0.0,
                y: peak_y as f32,
                z: (-g.roof_len / 2.0) as f32,
            };
            let along_z = Vec3 { x: 0.0, y: 0.0, z: 1.0 };
            let down_slope = if key == "roofL" {
                Vec3 { x: (-ang.cos()) as f32, y: (-ang.sin()) as f32, z: 0.0 }
            } else {
                Vec3 { x: ang.cos() as f32, y: (-ang.sin()) as f32, z: 0.0 }
            };
            Some(vec![
                project(start),
                project(add3(start, scale3(along_z, g.roof_len))),
                project(add3(add3(start, scale3(along_z, g.roof_len)), scale3(down_slope, g.s_l))),
                project(add3(start, scale3(down_slope, g.s_l))),
            ])
        }
        _ => None,
    }
}

fn deco_panel_clip_holes(
    p: &NichoirParams,
    g: &GeometryPayload,
    key: &str,
    origin: Vec3,
    u: Vec3,
    v: Vec3,
) -> Vec<Vec<(f64, f64)>> {
    if key != "front" {
        return Vec::new();
    }
    let base_y = if matches!(p.floor, FloorMode::Pose) { p.t } else { 0.0 };
    let eps = 0.08;
    facade_holes(p, g)
        .into_iter()
        .map(|hole| {
            hole.into_iter()
                .map(|(x, y)| {
                    project_to_deco(
                        origin,
                        u,
                        v,
                        Vec3 {
                            x: x as f32,
                            y: (base_y + y) as f32,
                            z: (p.d / 2.0 + eps) as f32,
                        },
                    )
                })
                .collect::<Vec<_>>()
        })
        .filter(|hole| hole.len() >= 3)
        .collect()
}

fn build_decor_tris_for_target(p: &NichoirParams, g: &GeometryPayload, key: &str) -> Vec<Tri> {
    let Some(d) = deco_for(p, key) else {
        return Vec::new();
    };
    let Some((origin, u, v, n)) = deco_basis_for_target(p, g, key, d) else {
        return Vec::new();
    };
    let mut tris = Vec::new();
    if d.mode == "heightmap" {
        let clip_poly = if d.clip_to_panel {
            deco_panel_clip_polygon(p, g, key, origin, u, v)
        } else {
            None
        };
        let clip_holes = if d.clip_to_panel {
            deco_panel_clip_holes(p, g, key, origin, u, v)
        } else {
            Vec::new()
        };
        add_heightmap_basis(&mut tris, d, origin, u, v, n, clip_poly.as_deref(), Some(&clip_holes));
    } else {
        let loops = deco_normalized_loops(d);
        for pts in loops {
            add_deco_loop_basis(&mut tris, &pts, d.depth, origin, u, v, n);
        }
    }
    clean_tris(tris)
}

fn build_all_decor_tris(p: &NichoirParams, g: &GeometryPayload) -> Vec<Tri> {
    let mut tris = Vec::new();
    for key in deco_target_keys() {
        tris.extend(build_decor_tris_for_target(p, g, key));
    }
    clean_tris(tris)
}

fn panel_export_parts(p: &NichoirParams, g: &GeometryPayload) -> Vec<(String, Vec<Tri>)> {
    let mut parts = vec![
        ("facade_avant".to_string(), front_panel_tris(p, g)),
        ("facade_arriere".to_string(), back_panel_tris(p, g)),
        ("cote_gauche".to_string(), side_panel_tris(p, g, true)),
        ("cote_droit".to_string(), side_panel_tris(p, g, false)),
        ("plancher".to_string(), floor_panel_tris(p, g)),
        ("toit_gauche".to_string(), roof_panel_tris(p, g, true)),
        ("toit_droit".to_string(), roof_panel_tris(p, g, false)),
    ];

    if p.wall_mount {
        parts.push(("bloc_fixation_mur".to_string(), wall_mount_block_tris(p, g)));
    }

    let door = door_panel_tris(p);
    if !door.is_empty() {
        parts.push(("porte".to_string(), door));
    }

    if p.perch && !matches!(p.door, DoorMode::None) {
        parts.push(("perchoir".to_string(), perch_tris(p)));
    }

    for key in deco_target_keys() {
        let tris = build_decor_tris_for_target(p, g, key);
        if !tris.is_empty() {
            parts.push((format!("deco_{key}"), tris));
        }
    }

    parts
}

fn render_mesh_offset(key: &str, color: &str, tris: &[Tri], dx: f32, dy: f32, dz: f32) -> RenderMesh {
    let mut vertices = Vec::with_capacity(tris.len() * 9);
    for t in tris {
        for v in [t.a, t.b, t.c] {
            vertices.push(v.x + dx);
            vertices.push(v.y + dy);
            vertices.push(v.z + dz);
        }
    }
    RenderMesh {
        key: key.to_string(),
        color: color.to_string(),
        vertices,
    }
}

fn build_scene_meshes(p: &NichoirParams) -> Vec<RenderMesh> {
    let g = GeometryPayload::from_p(p);
    let ang = p.slope * PI / 180.0;
    let base_y = if matches!(p.floor, FloorMode::Pose) { p.t } else { 0.0 };
    let peak_y = base_y + g.wall_h + g.roof_h;
    let roof_len = g.roof_len.max(0.5);
    let explode_dist = (p.explode / 100.0).max(0.0) as f32 * p.w.max(p.h).max(p.d) as f32 * 0.65;
    let mut out = Vec::new();

    let mut front = Vec::<Tri>::new();
    add_facade_with_cutouts(&mut front, p, &g, p.t, 0.0, base_y, p.d / 2.0 - p.t);
    out.push(render_mesh_offset("front", "#d4a574", &front, 0.0, 0.0, explode_dist));

    let mut back = Vec::<Tri>::new();
    add_back_panel_with_mount_holes(&mut back, p, &g, p.t, 0.0, base_y, -p.d / 2.0);
    out.push(render_mesh_offset("back", "#d4a574", &back, 0.0, 0.0, -explode_dist));

    if p.wall_mount {
        let mut block = Vec::<Tri>::new();
        add_wall_mount_block(&mut block, p, &g, base_y, -p.d / 2.0 - wall_mount_depth(p), true);
        out.push(render_mesh_offset("wallMount", "#7f6245", &clean_tris(block), 0.0, 0.0, -explode_dist * 1.25));
    }

    let mut sides = Vec::<Tri>::new();
    add_side_walls(&mut sides, p, &g, base_y);
    out.push(render_mesh_offset("sideWalls", "#c49464", &sides, 0.0, 0.0, 0.0));

    let mut bottom = Vec::<Tri>::new();
    add_floor_panel(&mut bottom, p, &g);
    out.push(render_mesh_offset("bottom", "#b48454", &bottom, 0.0, -explode_dist, 0.0));

    let mut roof_l = Vec::<Tri>::new();
    add_roof_panel_with_holes(&mut roof_l, p, &g, true, 0.0, peak_y, -roof_len / 2.0, ang);
    out.push(render_mesh_offset("roofL", "#9e7044", &clean_tris(roof_l), -explode_dist * 0.7, explode_dist * 0.7, 0.0));

    let mut roof_r = Vec::<Tri>::new();
    add_roof_panel_with_holes(&mut roof_r, p, &g, false, 0.0, peak_y, -roof_len / 2.0, -ang);
    out.push(render_mesh_offset("roofR", "#9e7044", &clean_tris(roof_r), explode_dist * 0.7, explode_dist * 0.7, 0.0));

    if !matches!(p.door, DoorMode::None) && p.door_panel {
        let door_y = base_y + p.door_py / 100.0 * g.wall_h;
        let door_w_local = g.w_bot - 2.0 * p.taper_x * (p.door_py / 100.0);
        let door_x = -door_w_local / 2.0 + p.door_px / 100.0 * door_w_local;
        let mut door = Vec::<Tri>::new();
        add_extruded_polygon_z(&mut door, &door_points(p), p.t, door_x, door_y, p.d / 2.0 + 1.0, 0.0);
        out.push(render_mesh_offset("doorPanel", "#e8c088", &door, 0.0, 0.0, explode_dist * 1.2));
    }

    if p.perch && !matches!(p.door, DoorMode::None) {
        let (perch_x, perch_y) = perch_center(p, &g);
        let mut perch = Vec::<Tri>::new();
        add_cylinder_z(
            &mut perch,
            perch_x,
            base_y + perch_y,
            p.d / 2.0,
            p.perch_diam / 2.0,
            p.perch_len,
            32,
        );
        out.push(render_mesh_offset("perch", "#8b6e4e", &perch, 0.0, 0.0, explode_dist * 1.4));
    }

    for key in deco_target_keys() {
        let tris = build_decor_tris_for_target(p, &g, key);
        if !tris.is_empty() {
            out.push(render_mesh_offset(&format!("deco_{key}"), "#e8a955", &tris, 0.0, 0.0, 0.0));
        }
    }

    out
}

#[wasm_bindgen]
pub fn scene_meshes_json(input: &str) -> String {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(err) => return err_json(&err),
    };
    ok_json(ScenePayload {
        meshes: build_scene_meshes(&p),
    })
}

#[wasm_bindgen]
pub fn export_house_stl(input: &str) -> Vec<u8> {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(_) => NichoirParams::default(),
    };

    let tris = build_house_tris(&p);
    write_stl("Nichoir House", &tris)
}

#[wasm_bindgen]
pub fn export_house_obj(input: &str) -> String {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(_) => NichoirParams::default(),
    };

    let tris = build_house_tris(&p);
    write_obj("Nichoir House", &tris)
}

#[wasm_bindgen]
pub fn export_door_stl(input: &str) -> Vec<u8> {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(_) => NichoirParams::default(),
    };

    let tris = door_panel_tris(&p);
    if tris.is_empty() {
        return Vec::new();
    }

    write_stl("Nichoir Door", &tris)
}

#[wasm_bindgen]
pub fn export_wall_mount_stl(input: &str) -> Vec<u8> {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(_) => NichoirParams::default(),
    };
    if !p.wall_mount {
        return Vec::new();
    }

    let g = GeometryPayload::from_p(&p);
    let tris = wall_mount_block_tris(&p, &g);
    if tris.is_empty() {
        return Vec::new();
    }

    write_stl("Nichoir Wall Mount Block", &tris)
}

#[wasm_bindgen]
pub fn export_panels_zip(input: &str) -> Vec<u8> {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(_) => NichoirParams::default(),
    };
    let g = GeometryPayload::from_p(&p);
    let entries = panel_export_parts(&p, &g)
        .into_iter()
        .map(|(name, tris)| {
            let file_name = format!("{name}.stl");
            let data = write_stl(&name, &tris);
            (file_name, data)
        })
        .collect();
    write_zip(entries)
}

#[wasm_bindgen]
pub fn mesh_report_json(input: &str) -> String {
    let p = match parse_input(input) {
        Ok(v) => v,
        Err(err) => return err_json(&err),
    };
    let g = GeometryPayload::from_p(&p);
    let house_tris = build_house_tris(&p);
    let parts = panel_export_parts(&p, &g);
    let zip_entries: Vec<ZipEntryReport> = parts
        .iter()
        .map(|(name, tris)| ZipEntryReport {
            name: format!("{name}.stl"),
            bytes: 84 + tris.len() * 50,
        })
        .collect();
    let zip_payload = write_zip(
        parts
            .iter()
            .map(|(name, tris)| (format!("{name}.stl"), write_stl(name, tris)))
            .collect(),
    );
    let part_reports = parts
        .iter()
        .map(|(name, tris)| analyze_mesh(name, tris))
        .collect();

    ok_json(MeshReportPayload {
        house: analyze_mesh("maison_complete", &house_tris),
        parts: part_reports,
        zip_bytes: zip_payload.len(),
        zip_entries,
    })
}

#[wasm_bindgen]
pub fn plan_preview_svg(input: &str) -> String {
    let p = parse_input(input).unwrap_or_default();
    let lang = p.lang.as_str();
    let g = GeometryPayload::from_p(&p);
    let cuts = build_cuts(&p, &g);
    let layout_json = compute_cut_layout(input);
    let v: serde_json::Value = match serde_json::from_str(&layout_json) {
        Ok(v) => v,
        Err(e) => return err_json(&format!("layout serialization fail: {e}")),
    };

    if !v.get("ok").and_then(|x| x.as_bool()).unwrap_or(false) {
        return layout_json;
    }

    let panel_w = v
        .get("payload")
        .and_then(|p| p.get("panel_w"))
        .and_then(|x| x.as_f64())
        .unwrap_or(2440.0);
    let panel_h = v
        .get("payload")
        .and_then(|p| p.get("panel_h"))
        .and_then(|x| x.as_f64())
        .unwrap_or(1220.0);
    let panel_label = v
        .get("payload")
        .and_then(|p| p.get("panel_label"))
        .and_then(|x| x.as_str())
        .unwrap_or(t(lang, "custom_manual"));

    let mut svg = String::new();
    svg.push_str(&format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{panel_w}mm\" height=\"{panel_h}mm\" viewBox=\"0 0 {panel_w} {panel_h}\">\n"
    ));
    svg.push_str(&format!(
        "<title>{} - {} x {} {}, {} {} {}</title>\n",
        t(lang, "plan_preview_title"),
        format_len(panel_w, &p.unit),
        format_len(panel_h, &p.unit),
        html_escape(unit_def(&p.unit).label),
        t(lang, "kerf"),
        format_len(p.kerf, &p.unit),
        html_escape(unit_def(&p.unit).label),
    ));
    svg.push_str(&format!(
        "<rect x=\"0\" y=\"0\" width=\"{panel_w:.3}\" height=\"{panel_h:.3}\" fill=\"#252018\" stroke=\"#4a4030\" stroke-width=\"2\"/>\n"
    ));
    svg.push_str(&format!(
        "<text x=\"12\" y=\"28\" font-size=\"18\" fill=\"#e8a955\">{}: {} | {}: {} x {} {} | {} {}</text>\n",
        t(lang, "panel_line"),
        html_escape(panel_label),
        t(lang, "format_used"),
        format_len(panel_w, &p.unit),
        format_len(panel_h, &p.unit),
        html_escape(unit_def(&p.unit).label),
        t(lang, "kerf"),
        format_len(p.kerf, &p.unit),
    ));
    let mut grid = 200.0;
    while grid < panel_w {
        svg.push_str(&format!("<line x1=\"{grid:.3}\" y1=\"0\" x2=\"{grid:.3}\" y2=\"{panel_h:.3}\" stroke=\"#302818\" stroke-width=\"0.8\"/>\n"));
        grid += 200.0;
    }
    grid = 200.0;
    while grid < panel_h {
        svg.push_str(&format!("<line x1=\"0\" y1=\"{grid:.3}\" x2=\"{panel_w:.3}\" y2=\"{grid:.3}\" stroke=\"#302818\" stroke-width=\"0.8\"/>\n"));
        grid += 200.0;
    }

    if let Some(arr) = v.get("payload").and_then(|p| p.get("pieces")).and_then(|x| x.as_array()) {
        for i in arr {
            let name = i.get("name").and_then(|x| x.as_str()).unwrap_or("piece");
            let x = i.get("px").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let y = i.get("py").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let w = i.get("w").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let h = i.get("h").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let color = i.get("color").and_then(|x| x.as_str()).unwrap_or("#444");
            let shape = i.get("shape").and_then(|x| x.as_str()).unwrap_or("rect");
            let wall_h = i.get("wall_h").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let w_top = i.get("w_top").and_then(|x| x.as_f64()).unwrap_or(w);
            let w_bot = i.get("w_bot").and_then(|x| x.as_f64()).unwrap_or(w);
            let overflow = i.get("overflow").and_then(|x| x.as_bool()).unwrap_or(false);
            let fill = if overflow { "#661a1a" } else { color };
            let base_name = name
                .split_whitespace()
                .next()
                .unwrap_or(name)
                .trim();
            let cut = cuts.iter().find(|c| {
                let cut_base = c.name.split_whitespace().next().unwrap_or(&c.name);
                cut_base == base_name
            });
            let dim_label = if let Some(cut) = cut {
                format!("{} x {} {}", cut.w_display, cut.h_display, unit_def(&p.unit).label)
            } else {
                format!(
                    "{} x {} {}",
                    format_len(w, &p.unit),
                    format_len(h, &p.unit),
                    unit_def(&p.unit).label,
                )
            };
            if shape == "pent" && wall_h > 0.0 {
                let w_max = w_bot.max(w_top);
                let bottom_inset = (w_max - w_bot) / 2.0;
                let top_inset = (w_max - w_top) / 2.0;
                let points = format!(
                    "{:.3},{:.3} {:.3},{:.3} {:.3},{:.3} {:.3},{:.3} {:.3},{:.3}",
                    x + bottom_inset,
                    y + h,
                    x + bottom_inset + w_bot,
                    y + h,
                    x + top_inset + w_top,
                    y + h - wall_h,
                    x + w_max / 2.0,
                    y,
                    x + top_inset,
                    y + h - wall_h,
                );
                svg.push_str(&format!(
                    "<polygon points=\"{points}\" fill=\"{fill}\" fill-opacity=\"0.78\" stroke=\"#e8a955\" stroke-width=\"2\"/>\n"
                ));
            } else {
                svg.push_str(&format!(
                    "<rect x=\"{x:.3}\" y=\"{y:.3}\" width=\"{w:.3}\" height=\"{h:.3}\" fill=\"{fill}\" fill-opacity=\"0.78\" stroke=\"#e8a955\" stroke-width=\"2\"/>\n"
                ));
            }
            let font = if w.min(h) < 90.0 { 10.0 } else { 13.0 };
            let label_lines: Vec<String> = [name.to_string(), dim_label]
                .iter()
                .filter(|line| !line.trim().is_empty())
                .cloned()
                .collect();
            let line_h = font + 3.0;
            let label_h = line_h * label_lines.len() as f64 + 6.0;
            let label_w = (w - 12.0).max(40.0);
            let label_x = x + 6.0;
            let label_box_y = y + (h - label_h) / 2.0;
            svg.push_str(&format!(
                "<rect x=\"{label_x:.3}\" y=\"{label_box_y:.3}\" width=\"{label_w:.3}\" height=\"{label_h:.3}\" fill=\"#1d1912\" fill-opacity=\"0.58\"/>\n"
            ));
            let mut label_y = label_box_y + font + 4.0;
            for line in label_lines {
                svg.push_str(&format!(
                    "<text x=\"{label_x:.3}\" y=\"{label_y:.3}\" font-size=\"{font:.1}\" fill=\"#fff\">{}</text>\n",
                    html_escape(&line)
                ));
                label_y += line_h;
                if label_y > y + h - 6.0 {
                    break;
                }
            }
        }
    }

    svg.push_str("</svg>");
    serde_json::to_string(&ApiOk {
        ok: true,
        payload: serde_json::json!({ "svg": svg }),
    })
    .unwrap_or_else(|_| err_json("Failed to serialize svg"))
}

#[wasm_bindgen]
pub fn default_params_json() -> String {
    serde_json::to_string(&NichoirParams::default()).unwrap_or_else(|_| "{}".to_string())
}

#[wasm_bindgen]
pub fn render_app_html(input: &str) -> String {
    let p = parse_input(input).unwrap_or_default();
    let g = GeometryPayload::from_p(&p);
    let cuts = build_cuts(&p, &g);
    let lang = p.lang.as_str();
    let unit = unit_def(&p.unit);
    let ridge = effective_ridge(&p);

    let mut cut_rows = String::new();
    for cut in cuts {
        cut_rows.push_str(&format!(
            "<div class=\"cut-row\"><span>{}</span><strong>{}</strong><small>{} x {} {}</small><em>{}</em></div>",
            html_escape(&cut.name),
            cut.qty,
            html_escape(&cut.w_display),
            html_escape(&cut.h_display),
            html_escape(unit.label),
            html_escape(&cut.note),
        ));
    }

    let body_controls = format!(
        "{}{}{}{}<div class=\"field-group\"><p>{}</p><div class=\"choices\">{}{}</div></div>",
        length_control(t(lang, "width"), "W", 80.0, 400.0, 1.0, p.w, &p.unit),
        length_control(t(lang, "height"), "H", 80.0, 500.0, 1.0, p.h, &p.unit),
        length_control(t(lang, "depth"), "D", 80.0, 400.0, 1.0, p.d, &p.unit),
        length_control(t(lang, "taper"), "taperX", -60.0, 60.0, 1.0, p.taper_x, &p.unit),
        t(lang, "floor"),
        choice_button(t(lang, "floor_enclave"), "floor", "enclave", floor_value(p.floor)),
        choice_button(t(lang, "floor_pose"), "floor", "pose", floor_value(p.floor)),
    );

    let hang_details = if p.hang_holes {
        format!(
            r#"<div class="subcontrols"><div class="corner-grid"><label class="check"><input data-bool="hangFL" type="checkbox" {}>{}</label><label class="check"><input data-bool="hangFR" type="checkbox" {}>{}</label><label class="check"><input data-bool="hangBL" type="checkbox" {}>{}</label><label class="check"><input data-bool="hangBR" type="checkbox" {}>{}</label></div>{}{}{}</div>"#,
            checked(p.hang_fl),
            html_escape(t(lang, "hang_front_left")),
            checked(p.hang_fr),
            html_escape(t(lang, "hang_front_right")),
            checked(p.hang_bl),
            html_escape(t(lang, "hang_back_left")),
            checked(p.hang_br),
            html_escape(t(lang, "hang_back_right")),
            length_control(t(lang, "hang_diam"), "hangDiam", 2.0, 30.0, 0.5, p.hang_diam, &p.unit),
            length_control(t(lang, "hang_side_offset"), "hangSideOffset", 2.0, 120.0, 1.0, p.hang_side_offset, &p.unit),
            length_control(t(lang, "hang_end_offset"), "hangEndOffset", 2.0, 120.0, 1.0, p.hang_end_offset, &p.unit),
        )
    } else {
        String::new()
    };
    let hang_controls = format!(
        r#"<div class="field-group disclosure-group advanced-group suspension-group"><p>{}</p><label class="check"><input data-bool="hangHoles" type="checkbox" {}>{}</label>{}</div>"#,
        t(lang, "hang_holes"),
        checked(p.hang_holes),
        t(lang, "hang_enable"),
        hang_details,
    );
    let wall_mount_details = if p.wall_mount {
        format!(
            r#"<div class="subcontrols">{}{}{}{}{}{}<p class="control-note">{}</p></div>"#,
            length_control(t(lang, "wall_mount_hole_diam"), "wallMountHoleDiam", 3.0, 20.0, 0.5, p.wall_mount_hole_diam, &p.unit),
            length_control(t(lang, "wall_mount_hole_spacing"), "wallMountHoleSpacing", 20.0, 220.0, 1.0, p.wall_mount_hole_spacing, &p.unit),
            length_control(t(lang, "wall_mount_y"), "wallMountY", 20.0, 440.0, 1.0, p.wall_mount_y, &p.unit),
            length_control(t(lang, "wall_mount_block_w"), "wallMountBlockW", 40.0, 260.0, 1.0, p.wall_mount_block_w, &p.unit),
            length_control(t(lang, "wall_mount_block_h"), "wallMountBlockH", 30.0, 220.0, 1.0, p.wall_mount_block_h, &p.unit),
            length_control(t(lang, "wall_mount_block_depth"), "wallMountBlockDepth", 6.0, 80.0, 1.0, p.wall_mount_block_depth, &p.unit),
            html_escape(t(lang, "wall_mount_note")),
        )
    } else {
        String::new()
    };
    let wall_mount_controls = format!(
        r#"<div class="field-group disclosure-group advanced-group wall-mount-group"><p>{}</p><label class="check"><input data-bool="wallMount" type="checkbox" {}>{}</label>{}</div>"#,
        t(lang, "wall_mount"),
        checked(p.wall_mount),
        t(lang, "wall_mount_enable"),
        wall_mount_details,
    );

    let material_controls = format!(
        r#"<div class="field-group disclosure-group advanced-group material-group"><p>{}</p>{}{}<p class="control-note">{}</p></div>"#,
        t(lang, "material"),
        thickness_preset_select(&p, lang),
        length_control(t(lang, "thickness"), "T", 3.0, 25.0, 0.5, p.t, &p.unit),
        html_escape(t(lang, "thickness_note")),
    );

    let roof_controls = format!(
        "{}{}<div class=\"field-group\"><p>{}</p><div class=\"choices\">{}{}{}</div>{}</div>{}{}{}",
        range_control(t(lang, "slope"), "slope", 10.0, 60.0, 1.0, p.slope, "deg"),
        length_control(t(lang, "overhang"), "overhang", 0.0, 80.0, 1.0, p.overhang, &p.unit),
        t(lang, "ridge"),
        choice_button(t(lang, "ridge_left"), "ridge", "left", ridge_value(ridge)),
        choice_button(t(lang, "ridge_right"), "ridge", "right", ridge_value(ridge)),
        choice_button(t(lang, "ridge_miter"), "ridge", "miter", ridge_value(ridge)),
        if matches!(ridge, RidgeMode::Miter) && !matches!(p.ridge, RidgeMode::Miter) {
            format!(r#"<p class="control-note">{}</p>"#, html_escape(t(lang, "ridge_auto_miter")))
        } else {
            String::new()
        },
        material_controls,
        hang_controls,
        wall_mount_controls,
    );

    let door_current = door_value(p.door);
    let door_shape_controls = format!(
        r#"<div class="field-group"><p>{}</p><div class="choices">{}{}{}{}</div></div>"#,
        t(lang, "door"),
        choice_button(t(lang, "door_none"), "door", "none", door_current),
        choice_button(t(lang, "door_round"), "door", "round", door_current),
        choice_button(t(lang, "door_square"), "door", "square", door_current),
        choice_button(t(lang, "door_pentagon"), "door", "pentagon", door_current),
    );
    let door_details = if matches!(p.door, DoorMode::None) {
        String::new()
    } else {
        let door_panel_details = if p.door_panel {
            range_control(t(lang, "door_var"), "doorVar", 85.0, 125.0, 1.0, p.door_var, "%")
        } else {
            String::new()
        };
        let perch_details = if p.perch {
            format!(
                "{}{}{}",
                length_control(t(lang, "perch_diam"), "perchDiam", 3.0, 20.0, 0.5, p.perch_diam, &p.unit),
                length_control(t(lang, "perch_len"), "perchLen", 10.0, 80.0, 1.0, p.perch_len, &p.unit),
                length_control(t(lang, "perch_off"), "perchOff", 5.0, 60.0, 1.0, p.perch_off, &p.unit),
            )
        } else {
            String::new()
        };
        format!(
            r#"<div class="subcontrols">{}{}{}{}<label class="check"><input data-bool="doorPanel" type="checkbox" {}>{}</label>{}<label class="check"><input data-bool="doorFollowTaper" type="checkbox" {}>{}</label><label class="check"><input data-bool="perch" type="checkbox" {}>{}</label>{}</div>"#,
            length_control(t(lang, "door_width"), "doorW", 15.0, 300.0, 1.0, p.door_w, &p.unit),
            length_control(t(lang, "door_height"), "doorH", 15.0, 400.0, 1.0, p.door_h, &p.unit),
            range_control(t(lang, "door_x"), "doorPX", 10.0, 90.0, 1.0, p.door_px, "%"),
            range_control(t(lang, "door_y"), "doorPY", 15.0, 85.0, 1.0, p.door_py, "%"),
            checked(p.door_panel),
            t(lang, "door_panel"),
            door_panel_details,
            checked(p.door_follow_taper),
            t(lang, "door_follow_taper"),
            checked(p.perch),
            t(lang, "perch"),
            perch_details,
        )
    };
    let door_controls = format!("{}{}", door_shape_controls, door_details);

    let panel_controls = format!(
        "{}{}{}{}",
        panel_preset_select(&p, lang),
        length_control(t(lang, "panel_width"), "panelW", 400.0, 3200.0, 10.0, p.panel_w, &p.unit),
        length_control(t(lang, "panel_height"), "panelH", 400.0, 3200.0, 10.0, p.panel_h, &p.unit),
        length_control(t(lang, "kerf"), "kerf", 0.0, 10.0, 0.1, p.kerf, &p.unit),
    );
    let active_deco_key = if deco_target_keys().contains(&p.decor_active.as_str()) {
        p.decor_active.as_str()
    } else {
        "front"
    };
    let default_deco = DecorSettings::default();
    let active_deco = p.decos.get(active_deco_key).unwrap_or(&default_deco);
    let mut deco_options = String::new();
    for key in deco_target_keys() {
        deco_options.push_str(&format!(
            r#"<option value="{}" {}>{}</option>"#,
            key,
            if key == active_deco_key { "selected" } else { "" },
            html_escape(deco_target_label(lang, key)),
        ));
    }
    let parsed_deco_count = if active_deco.source_text.trim().is_empty() {
        0
    } else {
        parse_deco_svg_loops(&active_deco.source_text).len()
    };
    let deco_status = if !active_deco.source_data.trim().is_empty() {
        t(lang, "deco_heightmap_loaded").to_string()
    } else if active_deco.source_text.trim().is_empty() {
        t(lang, "deco_no_file").to_string()
    } else if parsed_deco_count == 0 {
        t(lang, "deco_svg_empty").to_string()
    } else {
        format!("{}: {} {}", t(lang, "deco_svg_loaded"), parsed_deco_count, t(lang, "shape_count"))
    };
    let deco_has_source = !active_deco.source_text.trim().is_empty()
        || !active_deco.source_data.trim().is_empty();
    let deco_shape_controls = if deco_has_source {
        let heightmap_controls = format!(
            r#"<div class="subcontrols mode-settings">
        <label class="check"><input data-deco-bool="invert" type="checkbox" {invert}>{invert_label}</label>
        <label class="check"><input data-deco-bool="removeBg" type="checkbox" {remove_bg}>{remove_bg_label}</label>
        {res}{smooth}{bevel}{threshold}
      </div>"#,
            invert = checked(active_deco.invert),
            invert_label = html_escape(t(lang, "deco_invert")),
            remove_bg = checked(active_deco.remove_bg),
            remove_bg_label = html_escape(t(lang, "deco_remove_bg")),
            res = deco_range_control(t(lang, "deco_resolution"), "resolution", 8.0, 256.0, 8.0, active_deco.resolution, 1.0),
            smooth = deco_range_control(t(lang, "deco_smooth"), "smooth", 0.0, 100.0, 5.0, active_deco.smooth, 1.0),
            bevel = deco_range_control(t(lang, "deco_bevel"), "bevel", 0.0, 100.0, 5.0, active_deco.bevel, 1.0),
            threshold = deco_range_control(t(lang, "deco_threshold"), "threshold", 0.0, 60.0, 1.0, active_deco.threshold, 1.0),
        );
        format!(
            r#"<div class="field-group deco-relief-controls">
      <p>{relief_label}</p>
      <p class="control-note">{deco_note}</p>
      <div class="subcontrols deco-settings">
        {w}{h}{px}{py}{rot}{depth}
        {heightmap_controls}
        <label class="check"><input data-deco-bool="clipToPanel" type="checkbox" {clip}>{clip_label}</label>
      </div>
    </div>"#,
            relief_label = html_escape(t(lang, "deco_relief_settings")),
            deco_note = html_escape(t(lang, "deco_heightmap_note")),
            w = deco_length_control(t(lang, "width"), "w", 5.0, 400.0, 1.0, active_deco.w, &p.unit),
            h = deco_length_control(t(lang, "height"), "h", 5.0, 400.0, 1.0, active_deco.h, &p.unit),
            px = deco_range_control(t(lang, "door_x"), "posX", 0.0, 100.0, 1.0, active_deco.pos_x, 1.0),
            py = deco_range_control(t(lang, "door_y"), "posY", 0.0, 100.0, 1.0, active_deco.pos_y, 1.0),
            rot = deco_range_control(t(lang, "deco_rotation"), "rotation", 0.0, 360.0, 1.0, active_deco.rotation, 1.0),
            depth = deco_length_control(t(lang, "deco_depth"), "depth", 0.2, 20.0, 0.1, active_deco.depth, &p.unit),
            heightmap_controls = heightmap_controls,
            clip = checked(active_deco.clip_to_panel),
            clip_label = html_escape(t(lang, "deco_clip")),
        )
    } else {
        format!(r#"<p class="control-note">{}</p>"#, html_escape(t(lang, "choose_file_to_show_shape_settings")))
    };
    let deco_active_controls = format!(
        r#"<div class="deco-workflow" data-deco-workflow>
      <div class="deco-status" data-deco-status>{deco_status}</div>
      <label class="deco-dropzone {drop_state}" data-deco-dropzone>
        <input data-deco-file type="file" accept=".svg,image/*">
        <span class="deco-drop-icon" aria-hidden="true">▧</span>
        <span class="deco-drop-copy">
          <strong>{upload_title}</strong>
          <span>{upload_body}</span>
        </span>
      </label>
      <div class="deco-preview {preview_state}" data-deco-preview aria-live="polite"><span>{preview_empty}</span></div>
      <div class="deco-file-summary">
        <span data-deco-file-name></span>
        <small data-deco-file-meta></small>
      </div>
      <div class="deco-file-row">
        <button class="tool-button" data-deco-reload type="button">{replace_label}</button>
        <button class="tool-button deco-clear" data-deco-clear type="button">{clear_label}</button>
      </div>
      <label class="check deco-enable"><input data-deco-bool="enabled" type="checkbox" {enabled}>{enable_label}</label>
      {shape_controls}
    </div>"#,
        deco_status = html_escape(&deco_status),
        drop_state = if deco_has_source { "has-source" } else { "is-empty" },
        preview_state = if deco_has_source { "has-source" } else { "is-empty" },
        upload_title = html_escape(t(lang, "deco_upload_title")),
        upload_body = html_escape(t(lang, "deco_upload_body")),
        preview_empty = html_escape(t(lang, "deco_preview_empty")),
        replace_label = html_escape(t(lang, "deco_replace_image")),
        clear_label = html_escape(t(lang, "deco_clear")),
        enabled = checked(active_deco.enabled),
        enable_label = html_escape(t(lang, "deco_enable")),
        shape_controls = deco_shape_controls,
    );
    let deco_controls = format!(
        r#"
      <label class="select-control"><span>{target_label}</span><select data-deco-target>{deco_options}</select></label>
      {active_controls}
    "#,
        target_label = html_escape(t(lang, "deco_target")),
        deco_options = deco_options,
        active_controls = deco_active_controls,
    );
    let layout_json = compute_cut_layout(input);
    let layout_value: serde_json::Value = serde_json::from_str(&layout_json).unwrap_or_default();
    let layout_payload = layout_value.get("payload");
    let usage_ratio = layout_payload
        .and_then(|v| v.get("usage_ratio"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let total_cut_area = layout_payload
        .and_then(|v| v.get("total_area"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let effective_panel_w = layout_payload
        .and_then(|v| v.get("panel_w"))
        .and_then(|v| v.as_f64())
        .unwrap_or(p.panel_w);
    let effective_panel_h = layout_payload
        .and_then(|v| v.get("panel_h"))
        .and_then(|v| v.as_f64())
        .unwrap_or(p.panel_h);
    let panel_label = layout_payload
        .and_then(|v| v.get("panel_label"))
        .and_then(|v| v.as_str())
        .unwrap_or(t(lang, "custom_manual"));
    let panel_area = effective_panel_w * effective_panel_h;
    let plan_stats = format!(
        r#"<div class="plan-stats"><div class="stat-row"><span>{}</span><strong>{}</strong></div><div class="stat-row"><span>{}</span><strong>{} x {} {}</strong></div><div class="stat-row"><span>{}</span><strong>{:.1}%</strong></div><div class="stat-row"><span>{}</span><strong>{} {}</strong></div><div class="stat-row"><span>{}</span><strong>{} {}</strong></div><div class="stat-row"><span>{}</span><strong>{} {}</strong></div><div class="stat-row"><span>{}</span><strong>{:.1}°</strong></div><div class="stat-row"><span>{}</span><strong>{} {}</strong></div><div class="stat-row"><span>{}</span><strong>{} {}</strong></div><div class="stat-row"><span>{}</span><strong>{} {}</strong></div></div>"#,
        t(lang, "panel_selected"),
        html_escape(panel_label),
        t(lang, "format_used"),
        format_len(effective_panel_w, &p.unit),
        format_len(effective_panel_h, &p.unit),
        unit.label,
        t(lang, "usage"),
        usage_ratio,
        t(lang, "area_pieces"),
        format_area(total_cut_area, &p.unit),
        unit_area_label(&p.unit),
        t(lang, "area_panel"),
        format_area(panel_area, &p.unit),
        unit_area_label(&p.unit),
        t(lang, "kerf"),
        format_len(p.kerf, &p.unit),
        unit.label,
        t(lang, "side_angle"),
        g.side_angle_deg,
        t(lang, "side_roof_cut"),
        format_len(g.roof_side_cut, &p.unit),
        unit.label,
        t(lang, "floor_side_cut"),
        format_len(g.floor_side_cut, &p.unit),
        unit.label,
        t(lang, "ridge_bevel"),
        format_len(g.roof_ridge_cut, &p.unit),
        unit.label,
    );
    let account_controls = format!(r#"
      <div class="account-summary">
        <div class="account-balance">
          <span>{account_balance}</span>
          <strong data-account-balance>0</strong>
          <em>{server_source}</em>
        </div>
        <div class="stat-row"><span>{account_state}</span><strong data-account-state>-</strong></div>
        <div class="stat-row"><span>{account_email}</span><strong data-account-email-label>-</strong></div>
        <div class="stat-row"><span>{account_plan}</span><strong data-account-plan>{plan_none}</strong></div>
      </div>
      <div class="account-source-note">
        <span>{info}</span>
        <strong>{app_summary_only}</strong>
        <code>{account_server_master}</code>
      </div>
      <p class="account-error" data-account-error></p>
      <div class="download-groups account-actions">
        <div class="download-group">
          <h3>{auth}</h3>
          <p class="control-note" data-account-guest>{account_backend_note}</p>
          <p class="control-note" data-account-authed hidden>{session_active}</p>
          <div class="buttons compact-buttons action-buttons" data-account-authed hidden>
            <button class="action-tile" data-action="account-refresh" type="button"><span class="button-glyph" aria-hidden="true">↻</span><span class="button-label">{refresh}</span></button>
            <button class="action-tile" data-action="account-logout" type="button"><span class="button-glyph" aria-hidden="true">⏻</span><span class="button-label">{logout}</span></button>
          </div>
        </div>
        <div class="download-group">
          <h3>{account_balance}</h3>
          <div class="stat-row"><span>{available_credits}</span><strong data-account-balance>0</strong></div>
          <div class="stat-row"><span>{current_export_hold}</span><strong>{short_authorization}</strong></div>
          <div class="stat-row"><span>{costs}</span><strong>{server_cost_policy}</strong></div>
          <div class="buttons compact-buttons action-buttons">
            <a class="button-like action-tile" data-site-link="/pricing" href="/pricing"><span class="button-glyph" aria-hidden="true">↗</span><span class="button-label">{offers}</span></a>
            <button class="action-tile" data-action="token-pricing" type="button"><span class="button-glyph" aria-hidden="true">¤</span><span class="button-label">{costs}</span></button>
          </div>
        </div>
        <div class="download-group">
          <h3>{account_management}</h3>
          <p class="control-note">{account_backend_note}</p>
          <div class="buttons compact-buttons action-buttons">
            <a class="button-like action-tile" data-site-link="/account" href="/account"><span class="button-glyph" aria-hidden="true">↗</span><span class="button-label">{account}</span></a>
            <a class="button-like action-tile" data-site-link="/pricing" href="/pricing"><span class="button-glyph" aria-hidden="true">↗</span><span class="button-label">{pricing}</span></a>
          </div>
        </div>
        <div class="download-group ticket-widget" data-account-authed hidden>
          <h3>{support_tickets}</h3>
          <form class="ticket-mini-form" data-account-ticket-form>
            <label><span>{subject}</span><input name="subject" type="text" maxlength="140" placeholder="{ticket_subject_placeholder}" required></label>
            <label><span>{message}</span><textarea name="body" rows="3" maxlength="5000" placeholder="{ticket_message_placeholder}" required></textarea></label>
            <button type="submit">{create_ticket}</button>
          </form>
          <div class="ticket-mini-list" data-account-ticket-list>
            <p class="control-note">{no_ticket_loaded}</p>
          </div>
          <div class="ticket-mini-detail" data-account-ticket-detail hidden>
            <div class="ticket-mini-header">
              <strong data-account-ticket-title>{ticket}</strong>
              <button type="button" data-action="account-ticket-toggle">{close}</button>
            </div>
            <div class="ticket-mini-thread" data-account-ticket-thread></div>
            <form class="ticket-mini-form" data-account-ticket-reply-form>
              <label><span>{reply_label}</span><textarea name="body" rows="3" maxlength="5000" required></textarea></label>
              <button type="submit">{reply}</button>
            </form>
          </div>
        </div>
        <div class="download-group">
          <h3>{export_consumption}</h3>
          <div class="ledger-list">
            <div class="ledger-row"><span>{house_or_door_stl}</span><strong>{server_validated}</strong></div>
            <div class="ledger-row"><span>{plan_pdf_or_calcs_pdf}</span><strong>{server_validated}</strong></div>
            <div class="ledger-row"><span>{panels_zip}</span><strong>{server_validated}</strong></div>
            <div class="ledger-row"><span>{plan_svg_or_png}</span><strong>{server_validated}</strong></div>
          </div>
        </div>
      </div>
    "#,
        account_balance = html_escape(t(lang, "account_balance")),
        server_source = html_escape(t(lang, "server_source")),
        account_state = html_escape(t(lang, "account_state")),
        account_email = html_escape(t(lang, "account_email")),
        account_plan = html_escape(t(lang, "account_plan")),
        info = html_escape(t(lang, "info")),
        app_summary_only = html_escape(t(lang, "app_summary_only")),
        account_server_master = html_escape(t(lang, "account_server_master")),
        auth = html_escape(t(lang, "auth")),
        account_backend_note = html_escape(t(lang, "account_backend_note")),
        session_active = html_escape(t(lang, "session_active")),
        refresh = html_escape(t(lang, "refresh")),
        logout = html_escape(t(lang, "logout")),
        available_credits = html_escape(t(lang, "available_credits")),
        current_export_hold = html_escape(t(lang, "current_export_hold")),
        short_authorization = html_escape(t(lang, "short_authorization")),
        costs = html_escape(t(lang, "costs")),
        server_validated = html_escape(t(lang, "server_validated")),
        server_cost_policy = html_escape(t(lang, "server_cost_policy")),
        offers = html_escape(t(lang, "offers")),
        account_management = html_escape(t(lang, "account_management")),
        account = html_escape(t(lang, "account")),
        pricing = html_escape(t(lang, "pricing")),
        support_tickets = html_escape(t(lang, "support_tickets")),
        subject = html_escape(t(lang, "subject")),
        ticket_subject_placeholder = html_escape(t(lang, "ticket_subject_placeholder")),
        message = html_escape(t(lang, "message")),
        ticket_message_placeholder = html_escape(t(lang, "ticket_message_placeholder")),
        create_ticket = html_escape(t(lang, "create_ticket")),
        no_ticket_loaded = html_escape(t(lang, "no_ticket_loaded")),
        ticket = html_escape(t(lang, "ticket")),
        close = html_escape(t(lang, "close")),
        reply = html_escape(t(lang, "reply")),
        reply_label = html_escape(t(lang, "reply_label")),
        plan_none = html_escape(t(lang, "plan_none")),
        export_consumption = html_escape(t(lang, "export_consumption")),
        house_or_door_stl = html_escape(t(lang, "house_or_door_stl")),
        plan_pdf_or_calcs_pdf = html_escape(t(lang, "plan_pdf_or_calcs_pdf")),
        panels_zip = html_escape(t(lang, "panels_zip")),
        plan_svg_or_png = html_escape(t(lang, "plan_svg_or_png")),
    );
    let view_controls = format!(
        r#"<div class="viewer-controls" aria-label="{}"><div class="viewer-control-group"><p>{}</p><div class="choices">{}{}{}{}</div></div>{}</div>"#,
        html_escape(t(lang, "viewer_controls_aria")),
        t(lang, "view_mode"),
        choice_button(t(lang, "solid"), "mode", "solid", &p.mode),
        choice_button(t(lang, "wireframe"), "mode", "wireframe", &p.mode),
        choice_button(t(lang, "xray"), "mode", "xray", &p.mode),
        choice_button(t(lang, "edges"), "mode", "edges", &p.mode),
        range_control(t(lang, "explode"), "explode", 0.0, 100.0, 1.0, p.explode, "%"),
    );
    let theme_toggle_content = format!(
        r#"<span class="theme-glyph" data-theme-icon aria-hidden="true">☼</span><span class="theme-label" data-theme-label>{}</span>"#,
        html_escape(t(lang, "theme_light"))
    );
    let site_exit = icon_text("↗", "header-link-glyph", "header-link-label", t(lang, "back_to_site"));
    let tab_dim = icon_text("◫", "tab-glyph", "tab-label", t(lang, "dim_tab"));
    let tab_decor = icon_text("✦", "tab-glyph", "tab-label", t(lang, "decor"));
    let tab_calcs = icon_text("∑", "tab-glyph", "tab-label", t(lang, "calcs"));
    let tab_plan = icon_text("✂", "tab-glyph", "tab-label", t(lang, "cut_plan"));
    let tab_account = icon_text("◎", "tab-glyph", "tab-label", t(lang, "account"));
    let heading_body = icon_text("◫", "section-glyph", "section-label", t(lang, "body"));
    let heading_roof = icon_text("▲", "section-glyph", "section-label", t(lang, "roof"));
    let heading_door = icon_text("▣", "section-glyph", "section-label", t(lang, "door"));
    let heading_decor = icon_text("✦", "section-glyph", "section-label", t(lang, "decor"));
    let heading_calcs = icon_text("∑", "section-glyph", "section-label", t(lang, "calcs"));
    let heading_pieces = icon_text("▤", "section-glyph", "section-label", t(lang, "pieces"));
    let heading_cut_plan = icon_text("✂", "section-glyph", "section-label", t(lang, "cut_plan"));
    let heading_downloads = icon_text("⇩", "section-glyph", "section-label", t(lang, "downloads"));
    let heading_models = icon_text("◼", "group-glyph", "group-label", t(lang, "download_models_3d"));
    let heading_plans = icon_text("▧", "group-glyph", "group-label", t(lang, "download_plans"));
    let models_info = info_tip(t(lang, "models_3d_info"));
    let plans_info = info_tip(t(lang, "plans_info"));
    let heading_diagnostic = icon_text("◌", "group-glyph", "group-label", t(lang, "diagnostic"));
    let calc_pdf_label = icon_text("∑", "button-glyph", "button-label", t(lang, "download_calcs_pdf"));
    let export_house_label = icon_text("⌂", "button-glyph", "button-label", t(lang, "house"));
    let export_door_label = icon_text("▣", "button-glyph", "button-label", t(lang, "door"));
    let export_wall_mount_label =
        icon_text("▥", "button-glyph", "button-label", t(lang, "wall_mount_piece"));
    let export_panel_label = icon_text("▤", "button-glyph", "button-label", t(lang, "panel_stls"));
    let export_plan_label = icon_text("▧", "button-glyph", "button-label", t(lang, "plan"));
    let export_explosion_label = icon_text("✣", "button-glyph", "button-label", t(lang, "explosion"));
    let export_debug_label = icon_text("◈", "button-glyph", "button-label", t(lang, "debug"));
    let export_report_label = icon_text("≡", "button-glyph", "button-label", t(lang, "report"));
    let overlay_mode = icon_text("◩", "chip-glyph", "chip-label", &p.mode.to_uppercase());
    let overlay_floor = icon_text(
        "▤",
        "chip-glyph",
        "chip-label",
        if matches!(p.floor, FloorMode::Pose) {
            t(lang, "floor_pose_short")
        } else {
            t(lang, "floor_enclave_short")
        },
    );
    let overlay_ridge = icon_text(
        "⌃",
        "chip-glyph",
        "chip-label",
        match ridge {
            RidgeMode::Left => "G>D",
            RidgeMode::Right => "D>G",
            RidgeMode::Miter => "ONGLET",
        },
    );
    let wall_mount_export_button = if p.wall_mount {
        format!(
            r#"<button data-action="export-wall-mount">{export_wall_mount_label}<strong>.STL</strong></button>"#
        )
    } else {
        String::new()
    };

    format!(
        r##"
<aside class="panel">
  <header>
    <div class="header-top">
      <div>
        <h1>⌂ NICHOIR</h1>
        <p class="subtitle">{app_subtitle}</p>
      </div>
      <div class="header-actions">
        <div class="choices lang-switch" role="group" aria-label="{language}">
          <button class="choice {lang_fr_active}" data-action="lang-switch" data-lang="fr" type="button" aria-pressed="{lang_fr_pressed}">FR</button>
          <button class="choice {lang_en_active}" data-action="lang-switch" data-lang="en" type="button" aria-pressed="{lang_en_pressed}">EN</button>
        </div>
        <a class="header-site-link" data-site-link="/" href="/">{site_exit}</a>
        <button class="theme-toggle" data-action="theme-toggle" type="button" aria-pressed="false">{theme_toggle_content}</button>
      </div>
    </div>
  </header>

  <div class="unit-row">
    {unit_mm}
    {unit_cm}
    {unit_in}
  </div>

  <nav class="tabs">
    <button data-tab="dim">{tab_dim}</button>
    <button data-tab="decor">{tab_decor}</button>
    <button data-tab="calcs">{tab_calcs}</button>
    <button data-tab="plan">{tab_plan}</button>
    <button class="account-tab-button" data-action="account-modal-open" type="button" aria-haspopup="dialog" aria-controls="account-modal">{tab_account}</button>
  </nav>

  <div class="tab-scroll">
    <section data-panel="dim" class="control-section">
      <h2>{heading_body}</h2>{body_controls}
      <h2>{heading_roof}</h2>{roof_controls}
      <h2>{heading_door}</h2>{door_controls}
    </section>

    <section data-panel="decor" class="control-section">
      <h2>{heading_decor}</h2>{deco_controls}
    </section>

    <section data-panel="calcs" class="control-section">
      <h2>{heading_calcs}</h2>
      <div class="stat-row"><span>{volume_ext}</span><strong>{ext} {volume_unit}</strong></div>
      <div class="stat-row"><span>{volume_int}</span><strong>{int} {volume_unit}</strong></div>
      <div class="stat-row"><span>{material_volume}</span><strong>{mat} {volume_unit}</strong></div>
      <div class="stat-row"><span>{total_area}</span><strong>{area} {area_unit}</strong></div>
      <div class="stat-row"><span>{roof_label}</span><strong>{roof} {unit_label}</strong></div>
      <div class="stat-row"><span>{roof_pitch}</span><strong>{slope:.1}°</strong></div>
      <div class="stat-row"><span>{side_angle}</span><strong>{side_angle_value:.1}°</strong></div>
      <div class="stat-row"><span>{side_inset}</span><strong>{side_inset_value} {unit_label}</strong></div>
      <div class="stat-row"><span>{side_roof_cut}</span><strong>{side_roof_cut_value} {unit_label}</strong></div>
      <div class="stat-row"><span>{ridge_bevel}</span><strong>{ridge_bevel_value} {unit_label}</strong></div>
      <div class="stat-row"><span>{floor_bevel}</span><strong>{floor_bevel_value:.1}°</strong></div>
      <div class="stat-row"><span>{floor_side_cut}</span><strong>{floor_side_cut_value} {unit_label}</strong></div>
      <div class="stat-row"><span>{kerf_label}</span><strong>{kerf_value} {unit_label}</strong></div>
      <div class="buttons calc-actions">
        <button data-action="download-calcs-pdf" type="button">{calc_pdf_label}</button>
      </div>
      <h2>{heading_pieces}</h2>
      <div class="cut-list">{cut_rows}</div>
    </section>

    <section data-panel="plan" class="control-section">
      <h2>{heading_cut_plan}</h2>{panel_controls}
      {plan_stats}
      <div id="plan-preview" class="plan-preview"></div>
      <div class="download-section-heading">
        <h3>{heading_downloads}</h3>
        <p>{downloads_note}</p>
      </div>
      <div class="download-groups">
        <div class="download-group primary-downloads model-downloads">
          <h3>{heading_models}{models_info}</h3>
          <div class="buttons compact-buttons action-buttons">
            <button data-action="export-house">{export_house_label}<strong>.STL</strong></button>
            <button data-action="export-door">{export_door_label}<strong>.STL</strong></button>
            {wall_mount_export_button}
            <button class="action-tile primary-action" data-action="export-panels">{export_panel_label}<strong>.ZIP</strong></button>
          </div>
        </div>
        <div class="download-group primary-downloads">
          <h3>{heading_plans}{plans_info}</h3>
          <div class="buttons compact-buttons action-buttons">
            <button data-action="export-plan">{export_plan_label}<strong>.SVG</strong></button>
            <button data-action="download-plan-png" type="button">{export_plan_label}<strong>.PNG</strong></button>
            <button data-action="download-explosion-png" type="button">{export_explosion_label}<strong>.PNG</strong></button>
            <button class="action-tile primary-action" data-action="download-plan-pdf" type="button">{export_plan_label}<strong>.PDF</strong></button>
          </div>
        </div>
        <div class="download-group diagnostic-downloads" data-admin-only="true" hidden>
          <h3>{heading_diagnostic}</h3>
          <div class="buttons compact-buttons action-buttons">
            <button data-action="export-obj">{export_debug_label}<strong>.OBJ</strong></button>
            <button data-action="mesh-report">{export_report_label}<strong>.JSON</strong></button>
          </div>
        </div>
      </div>
    </section>

  </div>
</aside>

<main class="workspace">
  <div class="overlay"><span class="overlay-badge">{overlay_mode}</span><span class="overlay-badge">{overlay_floor}</span><span class="overlay-badge">{overlay_ridge}</span><button data-action="reset-view" type="button"><span class="button-glyph" aria-hidden="true">⟲</span><span>{reset_view}</span></button></div>
  {view_controls}
  <div id="viewer" class="viewer" aria-label="{viewer_preview_aria}"></div>
  <div class="axis-hint"><span class="x">X</span> {axis_width} <span class="y">Y</span> {axis_height} <span class="z">Z</span> {axis_depth}</div>
</main>

<div class="account-modal" id="account-modal" data-account-modal hidden>
  <div class="account-modal-backdrop" data-account-modal-close></div>
  <section class="account-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title" tabindex="-1">
    <header class="account-sheet-header">
      <div>
        <p class="eyebrow">{user_management}</p>
        <h2 id="account-title">{account}</h2>
        <p>{account_backend_source}</p>
      </div>
      <button class="modal-close" data-account-modal-close type="button" aria-label="{close_account_aria}"><span class="button-glyph" aria-hidden="true">×</span><span>{close_account}</span></button>
    </header>
    <div class="account-sheet-body">
      {account_controls}
    </div>
  </section>
</div>
"##,
        app_subtitle = t(lang, "app_subtitle"),
        theme_toggle_content = theme_toggle_content,
        site_exit = site_exit,
        language = t(lang, "language"),
        lang_fr_active = if lang == "fr" { "active" } else { "" },
        lang_en_active = if lang == "en" { "active" } else { "" },
        lang_fr_pressed = if lang == "fr" { "true" } else { "false" },
        lang_en_pressed = if lang == "en" { "true" } else { "false" },
        tab_dim = tab_dim,
        tab_decor = tab_decor,
        tab_calcs = tab_calcs,
        tab_plan = tab_plan,
        tab_account = tab_account,
        heading_body = heading_body,
        heading_roof = heading_roof,
        heading_door = heading_door,
        heading_decor = heading_decor,
        heading_calcs = heading_calcs,
        heading_pieces = heading_pieces,
        heading_cut_plan = heading_cut_plan,
        heading_downloads = heading_downloads,
        downloads_note = html_escape(t(lang, "downloads_note")),
        heading_models = heading_models,
        heading_plans = heading_plans,
        models_info = models_info,
        plans_info = plans_info,
        heading_diagnostic = heading_diagnostic,
        calc_pdf_label = calc_pdf_label,
        export_house_label = export_house_label,
        export_door_label = export_door_label,
        wall_mount_export_button = wall_mount_export_button,
        export_panel_label = export_panel_label,
        export_plan_label = export_plan_label,
        export_explosion_label = export_explosion_label,
        export_debug_label = export_debug_label,
        export_report_label = export_report_label,
        overlay_mode = overlay_mode,
        overlay_floor = overlay_floor,
        overlay_ridge = overlay_ridge,
        roof_label = t(lang, "roof"),
        account = t(lang, "account"),
        account_controls = account_controls,
        deco_controls = deco_controls,
        unit_mm = choice_button("mm", "unit", "mm", &p.unit),
        unit_cm = choice_button("cm", "unit", "cm", &p.unit),
        unit_in = choice_button("in", "unit", "in", &p.unit),
        body_controls = body_controls,
        view_controls = view_controls,
        roof_controls = roof_controls,
        door_controls = door_controls,
        panel_controls = panel_controls,
        plan_stats = plan_stats,
        reset_view = t(lang, "reset_view"),
        volume_ext = t(lang, "volume_ext"),
        volume_int = t(lang, "volume_int"),
        material_volume = t(lang, "material_volume"),
        total_area = t(lang, "total_area"),
        roof_pitch = t(lang, "roof_pitch"),
        side_angle = t(lang, "side_angle"),
        side_inset = t(lang, "side_inset"),
        side_roof_cut = t(lang, "side_roof_cut"),
        ridge_bevel = t(lang, "ridge_bevel"),
        floor_bevel = t(lang, "floor_bevel"),
        floor_side_cut = t(lang, "floor_side_cut"),
        kerf_label = t(lang, "kerf"),
        ext = format_volume(g.ext_volume, &p.unit),
        int = format_volume(g.int_volume, &p.unit),
        mat = format_volume(g.material_volume, &p.unit),
        area = format_area(g.total_area, &p.unit),
        roof = format_len(g.roof_h, &p.unit),
        slope = p.slope,
        side_angle_value = g.side_angle_deg,
        side_inset_value = format_len(g.side_inset, &p.unit),
        side_roof_cut_value = format_len(g.roof_side_cut, &p.unit),
        ridge_bevel_value = format_len(g.roof_ridge_cut, &p.unit),
        floor_bevel_value = g.side_angle_deg.abs(),
        floor_side_cut_value = format_len(g.floor_side_cut, &p.unit),
        kerf_value = format_len(p.kerf, &p.unit),
        unit_label = unit.label,
        viewer_preview_aria = t(lang, "viewer_preview_aria"),
        axis_width = t(lang, "axis_width"),
        axis_height = t(lang, "axis_height"),
        axis_depth = t(lang, "axis_depth"),
        user_management = t(lang, "user_management"),
        account_backend_source = t(lang, "account_backend_source"),
        close_account = t(lang, "close_account"),
        close_account_aria = t(lang, "close_account_aria"),
        area_unit = unit_area_label(&p.unit),
        volume_unit = unit_volume_label(&p.unit),
        cut_rows = cut_rows,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_input_clamps_extreme_numeric_values() {
        let input = r#"{
            "W": 999999,
            "H": 999999,
            "D": 1,
            "slope": -100,
            "T": 999,
            "mode": "bad",
            "unit": "bad",
            "panelW": 999999,
            "panelH": -10,
            "kerf": 999
        }"#;

        let p = parse_input(input).expect("valid JSON should parse");

        assert_eq!(p.w, 400.0);
        assert_eq!(p.h, 500.0);
        assert_eq!(p.d, 80.0);
        assert_eq!(p.slope, 10.0);
        assert_eq!(p.t, 25.0);
        assert_eq!(p.mode, "solid");
        assert_eq!(p.unit, "mm");
        assert_eq!(p.panel_w, 3200.0);
        assert_eq!(p.panel_h, 400.0);
        assert_eq!(p.kerf, 10.0);
    }

    #[test]
    fn parse_input_disables_unsafe_svg_decor() {
        let input = r##"{
            "decos": {
                "front": {
                    "enabled": true,
                    "sourceType": "svg",
                    "sourceText": "<svg><script>alert(1)</script><rect width=\"10\" height=\"10\"/></svg>",
                    "sourceData": "abcd",
                    "mode": "heightmap"
                }
            }
        }"##;

        let p = parse_input(input).expect("valid JSON should parse");
        let deco = p.decos.get("front").expect("front deco exists");

        assert!(!deco.enabled);
        assert!(deco.source_type.is_empty());
        assert!(deco.source_text.is_empty());
        assert!(deco.source_data.is_empty());
        assert_eq!(deco.mode, "heightmap");
    }

    #[test]
    fn parse_input_keeps_safe_simple_svg_decor() {
        let input = r##"{
            "decos": {
                "front": {
                    "enabled": true,
                    "sourceType": "svg",
                    "sourceText": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><g><rect x=\"1\" y=\"1\" width=\"8\" height=\"8\" fill=\"black\"/></g></svg>",
                    "mode": "vector"
                }
            }
        }"##;

        let p = parse_input(input).expect("valid JSON should parse");
        let deco = p.decos.get("front").expect("front deco exists");

        assert!(deco.enabled);
        assert_eq!(deco.source_type, "svg");
        assert!(deco.source_text.contains("<rect"));
        assert_eq!(parse_deco_svg_loops(&deco.source_text).len(), 1);
    }

    #[test]
    fn parse_input_rejects_svg_event_and_external_references() {
        let cases = [
            r#"<svg onload="alert(1)"><rect width="10" height="10"/></svg>"#,
            r#"<svg><image src="https://example.com/x.png"/></svg>"#,
            r##"<svg><use href="#shape"/></svg>"##,
            r#"<svg><path d="M0 0L10 0L10 10Z" style="fill:url(https://example.com/x.svg#p)"/></svg>"#,
            r#"<svg><rect width="10" height="10" onclick="alert(1)"/></svg>"#,
        ];

        for svg in cases {
            let input = serde_json::json!({
                "decos": {
                    "front": {
                        "enabled": true,
                        "sourceType": "svg",
                        "sourceText": svg,
                        "sourceData": "abcd",
                        "mode": "heightmap"
                    }
                }
            })
            .to_string();

            let p = parse_input(&input).expect("valid JSON should parse");
            let deco = p.decos.get("front").expect("front deco exists");
            assert!(!deco.enabled, "unsafe SVG should be disabled: {svg}");
            assert!(deco.source_type.is_empty());
            assert!(deco.source_text.is_empty());
            assert!(deco.source_data.is_empty());
            assert_eq!(deco.mode, "heightmap");
        }
    }

    #[test]
    fn render_app_html_exposes_heightmap_decor_upload_workflow() {
        let html = render_app_html(&default_params_json());

        assert!(html.contains("data-deco-workflow"));
        assert!(html.contains("data-deco-dropzone"));
        assert!(html.contains("data-deco-preview"));
        assert!(html.contains(".svg,image/*"));
        assert!(!html.contains("data-deco-choice=\"mode\""));
    }

    #[test]
    fn parse_input_preserves_raster_decor_source_data() {
        let input = r#"{
            "decos": {
                "front": {
                    "enabled": true,
                    "sourceType": "png",
                    "sourceText": "<svg><script>alert(1)</script></svg>",
                    "sourceData": "iVBORw0KGgo=",
                    "mode": "heightmap"
                }
            }
        }"#;

        let p = parse_input(input).expect("valid JSON should parse");
        let deco = p.decos.get("front").expect("front deco exists");

        assert!(deco.enabled);
        assert_eq!(deco.source_type, "png");
        assert!(deco.source_text.is_empty());
        assert_eq!(deco.source_data, "iVBORw0KGgo=");
        assert_eq!(deco.mode, "heightmap");
    }

    #[test]
    fn raster_heightmap_decor_generates_front_panel_tris() {
        use base64::Engine as _;
        use image::ImageEncoder as _;

        let pixels = [
            0u8, 0, 0, 255, 255, 255, 255, 255,
            128, 128, 128, 255, 64, 64, 64, 255,
        ];
        let mut png = Vec::new();
        image::codecs::png::PngEncoder::new(&mut png)
            .write_image(&pixels, 2, 2, image::ColorType::Rgba8.into())
            .expect("test PNG should encode");
        let data = base64::engine::general_purpose::STANDARD.encode(png);
        let input = serde_json::json!({
            "decos": {
                "front": {
                    "enabled": true,
                    "sourceType": "png",
                    "sourceData": data,
                    "mode": "heightmap",
                    "w": 40,
                    "h": 40,
                    "resolution": 8,
                    "depth": 3
                }
            }
        })
        .to_string();

        let p = parse_input(&input).expect("valid JSON should parse");
        let g = GeometryPayload::from_p(&p);
        let tris = build_decor_tris_for_target(&p, &g, "front");

        assert!(!tris.is_empty());
    }

    #[test]
    fn wall_mount_is_absent_by_default() {
        let p = NichoirParams::default();
        let g = GeometryPayload::from_p(&p);
        let parts = panel_export_parts(&p, &g);

        assert!(!p.wall_mount);
        assert!(wall_mount_holes(&p, &g).is_empty());
        assert!(!parts.iter().any(|(name, _)| name == "bloc_fixation_mur"));
    }

    #[test]
    fn wall_mount_adds_rear_holes_and_export_block() {
        let input = r#"{
            "wallMount": true,
            "overhang": 36,
            "wallMountBlockDepth": 0,
            "wallMountHoleDiam": 8,
            "wallMountHoleSpacing": 70,
            "wallMountY": 120
        }"#;

        let p = parse_input(input).expect("wall mount params should parse");
        let g = GeometryPayload::from_p(&p);
        let parts = panel_export_parts(&p, &g);

        assert!(p.wall_mount);
        assert_eq!(wall_mount_depth(&p), 36.0);
        assert_eq!(wall_mount_holes(&p, &g).len(), 2);
        assert!(parts.iter().any(|(name, tris)| name == "bloc_fixation_mur" && !tris.is_empty()));
    }

    #[test]
    fn wall_mount_independent_export_requires_wall_mount() {
        assert!(export_wall_mount_stl("{}").is_empty());

        let bytes = export_wall_mount_stl(r#"{"wallMount":true,"overhang":36}"#);
        assert!(bytes.len() > 84);

        let tri_count = u32::from_le_bytes(bytes[80..84].try_into().unwrap()) as usize;
        assert_eq!(bytes.len(), 84 + tri_count * 50);
    }

    #[test]
    fn wall_mount_block_top_sheds_water_outward() {
        let input = r#"{
            "wallMount": true,
            "overhang": 36,
            "wallMountBlockDepth": 0,
            "wallMountBlockH": 70,
            "wallMountHoleDiam": 8,
            "wallMountHoleSpacing": 70,
            "wallMountY": 120
        }"#;

        let p = parse_input(input).expect("wall mount params should parse");
        let g = GeometryPayload::from_p(&p);
        let m = wall_mount_geometry(&p, &g);
        let tris = wall_mount_block_tris(&p, &g);

        let max_y_at_z = |z: f64| -> f32 {
            tris.iter()
                .flat_map(|tri| [tri.a, tri.b, tri.c])
                .filter(|v| ((v.z as f64) - z).abs() < 0.01)
                .map(|v| v.y)
                .fold(f32::NEG_INFINITY, f32::max)
        };

        let exterior_y = max_y_at_z(WALL_MOUNT_SHED_INSET);
        let wall_y = max_y_at_z(m.block_depth - WALL_MOUNT_SHED_INSET);

        assert!(wall_y.is_finite());
        assert!(exterior_y.is_finite());
        assert!(wall_y > exterior_y + 10.0);
    }
}
