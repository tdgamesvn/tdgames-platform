# TD GAMES PLATFORM — Dashboard UI/UX Style Guide

_v1.0 — 2026-05-21 | Internal Dashboard, Desktop-first_

> **AI INSTRUCTION:** Đọc file này TRƯỚC khi thiết kế hoặc viết bất kỳ UI component nào.
> Mọi component mới phải tuân theo các pattern dưới đây. Không tự bịa pattern mới.

---

## ⚠️ Nguyên tắc cốt lõi

1. **Đây là internal dashboard, KHÔNG phải landing page.** Ưu tiên theo thứ tự: tốc độ đọc thông tin → hiệu quả thao tác → thẩm mỹ.
2. **Tailwind CDN + inline style.** Không có file CSS riêng cho component. Dùng Tailwind class + `style={{}}` cho giá trị không có trong config.
3. **Dark-only.** Không có light theme cho apps nội bộ (Navbar có light prop cho legacy, không tạo mới).
4. **Font: Montserrat.** Google Fonts, load `wght@400;500;600;700;800;900`. `font-black` = weight 900.
5. **Không dùng `max-w-*` bên trong tab/page component** — để parent `max-w-[1400px]` trong `<main>` lo.

---

## 🎨 Color Tokens

### Tailwind classes (đã config trong index.html)

| Class | Hex | Dùng cho |
|-------|-----|---------|
| `bg-bg` | #0F0F0F | App background |
| `bg-surface` | #1A1A1A | Card, input, dropdown background |
| `text-primary` / `bg-primary` | #FF9500 | CTA, accent, active state, link, active tab fill |
| `text-neutral-medium` | #9D9C9D | Muted text, placeholder, icon inactive |
| `text-neutral-light` | #F2F2F2 | Body text |
| `text-neutral-dark` | #404040 | Divider, disabled |
| `text-status-success` | #4CAF50 | Success badge, positive value |
| `text-status-error` | #F44336 | Error badge, negative value |
| `text-status-warning` | #FFA726 | Warning badge |
| `text-status-info` | #2196F3 | Info badge |

### Inline rgba hay dùng (không có Tailwind class — dùng `style={{}}`)

```
rgba(255,255,255,0.02)   → card background default
rgba(255,255,255,0.04)   → card hover / highlighted row
rgba(255,149,0,0.03)     → primary-tinted card bg (sidebar, summary)
rgba(255,149,0,0.12)     → primary-tinted card border
rgba(255,255,255,0.05)   → icon container bg, subtle chip bg
rgba(255,255,255,0.08)   → card border default  (= border-white/8)
```

---

## 📝 Typography — Dashboard Scale

> **Rule:** Labels = nhỏ + đậm + uppercase. Data = medium + semibold. Section title ≤ 16px.

| Role | Size | Weight | Tailwind pattern |
|------|------|--------|-----------------|
| Field label / metadata | 10px | 800 | `text-[10px] font-black uppercase tracking-wider text-neutral-600` |
| Tiny label / sub-badge | 9px | 700 | `text-[9px] font-bold uppercase tracking-widest` |
| Data value / body | 13–14px | 600 | `text-sm font-semibold text-white` |
| Mono value (số, mã, STK) | 13–14px | 400 | `text-sm font-mono tracking-wider text-white` |
| Section title | 14–16px | 800 | `text-base font-black uppercase tracking-wider text-white` |
| Page heading | 18–20px | 800 | `text-lg font-black text-white` |
| Caption / hint | 12px | 400–500 | `text-xs text-neutral-medium` |
| KPI / big number | 24–28px | 800 | `text-2xl font-black text-white` (exception duy nhất cho số lớn) |

**KHÔNG dùng:** `text-3xl` trở lên trong dashboard apps.

---

## 🔘 Buttons — 3 Tiers

### XS — inline action (trong list/table: Xem, Xoá, Tải về)
```jsx
className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider
           text-neutral-300 border border-white/10
           hover:text-white hover:border-white/20 transition-all"
```

### SM — panel action (Thêm, Upload, Lưu, Huỷ, Chỉnh sửa)

```jsx
// Primary (action chính)
className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider
           text-white transition-all disabled:opacity-50"
style={{ background: '#FF9500' }}

// Ghost (Huỷ, secondary)
className="px-4 py-2 rounded-xl text-xs font-black uppercase
           text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"

// Outline orange (Chỉnh sửa, tertiary)
className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider
           text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all"
```

### MD — primary CTA (dùng rất hạn chế, action quan trọng nhất của màn hình)
```jsx
className="px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider
           text-white transition-all shadow-btn-glow hover:shadow-btn-glow-hover"
style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)' }}
```

> **KHÔNG dùng:** `hover:scale-105`, `hover:translateY(-2px)` trong dashboard — gây layout shift.

---

## 📦 Cards

### Default card (thông tin, form section)
```jsx
className="rounded-2xl border border-white/8 p-6"
style={{ background: 'rgba(255,255,255,0.02)' }}
```

### Primary-tinted card (sidebar summary, highlight)
```jsx
className="rounded-2xl border p-5"
style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}
```

### List item / row card
```jsx
className="flex items-center gap-4 p-4 rounded-2xl border border-white/5
           hover:border-white/10 transition-all"
style={{ background: 'rgba(255,255,255,0.02)' }}
```

### Stats / KPI card
```jsx
className="rounded-2xl border border-white/8 p-5 space-y-1"
style={{ background: 'rgba(255,255,255,0.02)' }}
// Label: text-[10px] font-black uppercase tracking-wider text-neutral-600
// Value: text-2xl font-black text-white
// Delta: text-xs font-semibold text-status-success / text-status-error
```

> **KHÔNG dùng:** `hover:translateY(-8px)` — landing page pattern.

---

## 🏷️ Badges / Status Chips

```jsx
// Dynamic color badge (dùng nhiều nhất)
className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
style={{ background: `${color}20`, color: color }}
// color gợi ý: #FF9500 | #34C759 | #F44336 | #FFA726 | #0A84FF | #AF52DE | #FF375F

// Primary badge (active, chính)
className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400"

// Status dot + text
<>
  <span className="w-1.5 h-1.5 rounded-full bg-status-success inline-block mr-1.5" />
  <span className="text-xs text-status-success font-semibold">Active</span>
</>
```

---

## 📝 Form Inputs

```jsx
// Text input
className="px-3 py-2 rounded-xl text-sm text-white border border-white/10
           outline-none focus:border-orange-500/50 transition-colors w-full"
style={{ background: '#1a1a1a' }}

// Select
className="px-3 py-2 rounded-xl text-sm text-white border border-white/10
           outline-none focus:border-orange-500/50 transition-colors"
style={{ background: '#1a1a1a' }}

// Textarea
className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10
           outline-none focus:border-orange-500/50 transition-colors resize-none"
style={{ background: '#1a1a1a' }}

// Label
className="text-neutral-500 text-[10px] font-black uppercase tracking-wider"

// Field wrapper pattern
<div className="flex flex-col gap-1">
  <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">
    Tên trường
  </label>
  <input className="..." style={{ background: '#1a1a1a' }} />
</div>

// Error message
className="p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5"
```

---

## 📐 Layout & Spacing

### App shell chuẩn
```jsx
<div className="min-h-screen flex flex-col relative overflow-hidden"
     style={{ backgroundColor: '#0F0F0F' }}>
  <AppBackground />
  <ToastNotification ... />   {/* nếu cần */}
  <Navbar ... />
  <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
    {/* content — KHÔNG dùng max-w-* ở đây */}
  </main>
  <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
    TD Games • Enterprise Platform • v3.0
  </footer>
  <HelpPanel ... />
</div>
```

### Grid gaps chuẩn

| Use case | Class | px |
|----------|-------|----|
| Form field grid | `gap-4` | 16px |
| Card grid | `gap-6` | 24px |
| Section spacing | `space-y-6` | 24px |
| Tight list | `space-y-3` | 12px |
| Label → value | `gap-1` | 4px |
| Icon → text | `gap-2` hoặc `gap-3` | 8–12px |

### 2-column dashboard layout (main + sidebar)
```jsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
  <div className="lg:col-span-2">
    {/* Main content */}
  </div>
  <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4">
    {/* Sidebar */}
  </div>
</div>
```

---

## 🎭 Animations

| Class | Keyframe | Dùng khi |
|-------|----------|---------|
| `animate-fadeInUp` | fadeInUp 0.6s ease-out | Page/section load |
| `animate-scaleIn` | scaleIn 0.4s ease-out | Modal, dropdown xuất hiện |
| `animate-shake` | shake 0.4s | Form validation error |
| `animate-td-pulse` | tdPulse 1.5s infinite | Loading indicator |

> Transition speed: dùng `transition-all` mặc định (150ms). KHÔNG dùng `duration-500+` cho interactive elements.

---

## 🧩 Empty States

```jsx
<div className="text-center py-16 text-neutral-700 text-sm">
  <p className="text-3xl mb-3">{emoji}</p>
  <p className="text-neutral-600 text-sm">Chưa có dữ liệu</p>
  <p className="text-xs mt-1 text-neutral-700">Gợi ý action nếu có</p>
</div>
```

---

## 🍞 Toast Notifications

Dùng component `<ToastNotification>` có sẵn — **KHÔNG tự tạo toast mới**.

```jsx
// Trong state
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

// Render
{toast && (
  <ToastNotification
    message={{ text: toast.message, type: toast.type }}
    onDismiss={() => setToast(null)}
  />
)}

// Trigger
setToast({ message: 'Lưu thành công', type: 'success' });
setToast({ message: e.message || 'Có lỗi xảy ra', type: 'error' });
```

---

## ♿ Accessibility

- **Focus ring:** tự động qua `:focus-visible` — `outline: 3px solid #FF9500; outline-offset: 2px` (đã có trong `index.html`)
- **Disabled:** luôn thêm `disabled:opacity-50` và `disabled={saving/loading}` vào buttons
- **Loading state:** đổi button text → `"Đang lưu..."` / `"Đang tải..."` khi processing
- **SR-only:** class `.sr-only` đã có trong `index.html`

---

## ❌ Những gì KHÔNG được làm

| ❌ Tránh | ✅ Thay bằng |
|----------|-------------|
| `hover:scale-105` trên card/button | Chỉ đổi border-color hoặc bg |
| `hover:translateY(-8px)` | — (bỏ hẳn trong dashboard) |
| `text-3xl` trở lên | `text-lg` (18px) là max thông thường |
| `max-w-3xl` hoặc `max-w-*` trong tab component | Bỏ, để parent `max-w-[1400px]` lo |
| Tự tạo toast, modal overlay | Dùng `<ToastNotification>` có sẵn |
| `font-sans`, `font-mono` làm default | Montserrat (`font-montserrat`) là font duy nhất |
| Hardcode màu ngoài token | Dùng rgba từ bảng token ở trên |
| Section spacing 80–120px | `space-y-6` / `gap-6` (24px) |
| `transition-all duration-500` | `transition-all` (150ms mặc định) |
| `min-h-screen` trong tab component | Chỉ dùng ở root app wrapper |

---

_Cập nhật file này bất cứ khi nào có pattern mới được chuẩn hoá._
