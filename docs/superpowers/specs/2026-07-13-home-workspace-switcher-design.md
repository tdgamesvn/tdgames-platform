# Design — Workspace Switcher trên HomeScreen

**Ngày:** 2026-07-13
**Trạng thái:** Approved (đã duyệt qua chat)

---

## Vấn đề

Switcher sổ TD Games / TD Consulting hiện chỉ có trên `Navbar` — nằm *trong* từng
mini-app. Muốn đổi sổ, user phải mở app trước rồi mới đổi được, dù state
(`WorkspaceContext`) đã là global (`WorkspaceProvider` bọc ở root `index.tsx`,
persist `localStorage`) nên đổi ở đâu cũng phản ánh ra mọi app ngay — chỉ thiếu
chỗ đổi ngay tại `HomeScreen`.

## Giải pháp

Thêm switcher ngay trên `HomeScreen`, dùng chung `useWorkspace()` — không cần
logic đồng bộ gì thêm vì context đã global sẵn.

### 1. Tách `WorkspaceSwitcher.tsx`

Component dùng chung cho `Navbar` và `HomeScreen`, 2 variant:

- **`compact`** (mặc định, dùng trong `Navbar`): giữ nguyên `<select>` nhỏ hiện tại,
  theme-aware (dark/light), không đổi hành vi/UI so với bây giờ.
- **`pill`** (dùng trong `HomeScreen`): segmented toggle 2 nút cạnh nhau trong 1
  pill container, to và nổi bật hơn:
  - Nút đang active: tô nền theo màu workspace — `bg-primary/20 border-primary
    text-primary` cho TD Games, `bg-blue-500/20 border-blue-400 text-blue-400`
    cho TD Consulting.
  - Nút không active: mờ (`text-white/40`, không border).
  - Container: `bg-surface/60 border border-white/10 rounded-full`, padding đủ
    để bấm thoải mái (không phải dropdown — click trực tiếp đổi).

Cả 2 variant đọc/ghi `useWorkspace()` nội bộ, không cần props ngoài `variant`.

### 2. Vị trí trên HomeScreen

`header` hiện tại là `flex items-center justify-between` (logo trái — user info
phải). Thêm `relative` cho header, chèn `WorkspaceSwitcher variant="pill"` với
`absolute left-1/2 -translate-x-1/2` để luôn canh giữa tuyệt đối, không lệch khi
2 bên có độ rộng khác nhau (badge role, tên user dài/ngắn...).

### 3. Quyền xem

Giữ nguyên rule của Navbar: chỉ render khi `hasAnyRole(currentUser, ['admin',
'ke_toan', 'hr'])`. Member/freelancer không thấy — không liên quan sổ sách.

## Phạm vi

| File | Thay đổi |
|---|---|
| `components/WorkspaceSwitcher.tsx` | **Mới** — extract logic từ Navbar, thêm variant `pill` |
| `components/Navbar.tsx` | Thay đoạn `<select>` inline bằng `<WorkspaceSwitcher variant="compact" theme={theme} />` |
| `components/HomeScreen.tsx` | Thêm `<WorkspaceSwitcher variant="pill" />` canh giữa header, gate theo role |

Không đụng `WorkspaceContext.tsx`, không migration, không đổi behavior filter dữ
liệu — chỉ thêm 1 điểm truy cập UI mới cho state đã có sẵn.

## Ngoài phạm vi

- Không đổi role được phép switch (giữ admin/ke_toan/hr).
- Không thêm animation/transition phức tạp — dùng transition có sẵn theo pattern
  Tailwind hiện tại của codebase (`transition-all`).
